package com.absystems.adapter;

import com.absystems.domain.Account;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class Accounts implements com.absystems.domain.AccountDirectory {
  private final JdbcTemplate db;
  private final PasswordEncoder encoder;

  public Accounts(JdbcTemplate db, PasswordEncoder encoder) {
    this.db = db;
    this.encoder = encoder;
  }

  public List<Account> all() {
    return db.query(
        "SELECT * FROM users ORDER BY name",
        (r, n) ->
            new Account(
                r.getString("id"),
                r.getString("email"),
                r.getString("name"),
                r.getString("role"),
                r.getString("department"),
                r.getString("position"),
                r.getBoolean("crm_access")));
  }

  public void lock(String id) {
    db.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE", String.class, id);
  }

  public Account email(String email) {
    return all().stream().filter(a -> a.email().equalsIgnoreCase(email)).findFirst().orElse(null);
  }

  public Account id(String id) {
    return all().stream()
        .filter(a -> a.id().equals(id))
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalidAccount"));
  }

  public String password(String email) {
    return db.queryForObject(
        "SELECT password FROM users WHERE email=?", String.class, email.toLowerCase(Locale.ROOT));
  }

  public Account create(String email, String name, String password, String role) {
    if (email == null
        || !email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
        || email.length() > 254
        || name == null
        || name.isBlank()
        || name.length() > 120
        || password == null
        || password.length() < 12
        || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72
        || !Set.of("ADMIN", "EMPLOYEE", "CUSTOMER").contains(role))
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalidAccount");
    String id = UUID.randomUUID().toString();
    try {
      db.update(
          "INSERT INTO users(id,email,password,name,role) VALUES(?,?,?,?,?)",
          id,
          email.toLowerCase(Locale.ROOT),
          encoder.encode(password),
          name,
          role);
    } catch (org.springframework.dao.DuplicateKeyException e) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "accountExists");
    }
    return id(id);
  }

  public Account update(String id, Map<String, Object> data) {
    Account a = id(id);
    String role = Objects.toString(data.getOrDefault("role", a.role()));
    if (!Set.of("EMPLOYEE", "ADMIN").contains(role) || !a.staff())
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalidAccount");
    if (a.admin() && !role.equals("ADMIN") && all().stream().filter(Account::admin).count() == 1)
      throw new ResponseStatusException(HttpStatus.CONFLICT, "lastAdmin");
    db.update(
        "UPDATE users SET role=?,department=?,position=?,crm_access=? WHERE id=?",
        role,
        Objects.toString(data.getOrDefault("department", a.department())),
        Objects.toString(data.getOrDefault("position", a.position())),
        Boolean.TRUE.equals(data.get("crmAccess")),
        id);
    return id(id);
  }
}
