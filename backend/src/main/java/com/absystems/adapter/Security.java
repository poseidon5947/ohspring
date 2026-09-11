package com.absystems.adapter;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.*;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class Security {
  @Bean
  PasswordEncoder encoder() {
    return new BCryptPasswordEncoder(12);
  }

  @Bean
  UserDetailsService details(Accounts accounts) {
    return email -> {
      var a = accounts.email(email);
      if (a == null) throw new UsernameNotFoundException("invalidCredentials");
      return User.withUsername(a.email())
          .password(accounts.password(a.email()))
          .roles(a.role())
          .build();
    };
  }

  @Bean
  SecurityFilterChain chain(HttpSecurity http) throws Exception {
    return http.csrf(c -> c.ignoringRequestMatchers("/api/webhooks/wompi", "/api/webhooks/bank"))
        .authorizeHttpRequests(
            a ->
                a.requestMatchers(
                        "/api/csrf",
                        "/api/auth/register",
                        "/api/auth/login",
                        "/api/contact",
                        "/api/health",
                        "/api/webhooks/wompi",
                        "/api/webhooks/bank")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .formLogin(
            f ->
                f.loginProcessingUrl("/api/auth/login")
                    .successHandler(
                        (q, r, a) -> {
                          r.setContentType("application/json");
                          r.getWriter().write("{\"ok\":true}");
                        })
                    .failureHandler(
                        (q, r, e) -> {
                          r.setStatus(401);
                          r.setContentType("application/json");
                          r.getWriter().write("{\"error\":\"invalidCredentials\"}");
                        }))
        .logout(
            l ->
                l.logoutUrl("/api/auth/logout").logoutSuccessHandler((q, r, a) -> r.setStatus(204)))
        .exceptionHandling(e -> e.authenticationEntryPoint((q, r, x) -> r.setStatus(401)))
        .build();
  }

  @Bean
  ApplicationRunner bootstrap(
      Accounts accounts,
      @Value("${app.admin.email}") String email,
      @Value("${app.admin.password}") String password) {
    return args -> {
      if (!email.isBlank() && accounts.email(email) == null)
        accounts.create(email, "Administrator", password, "ADMIN");
    };
  }
}
