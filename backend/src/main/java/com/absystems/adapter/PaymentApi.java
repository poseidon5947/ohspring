package com.absystems.adapter;

import static com.absystems.application.PlatformService.*;

import com.absystems.application.PlatformService;
import com.absystems.domain.*;
import com.fasterxml.jackson.databind.*;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.util.*;
import org.springframework.core.env.Environment;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class PaymentApi {
  private final PlatformService service;
  private final Api api;
  private final Accounts accounts;
  private final JdbcTemplate db;
  private final Environment env;
  private final ObjectMapper json;

  public PaymentApi(
      PlatformService service,
      Api api,
      Accounts accounts,
      JdbcTemplate db,
      Environment env,
      ObjectMapper json) {
    this.service = service;
    this.api = api;
    this.accounts = accounts;
    this.db = db;
    this.env = env;
    this.json = json;
  }

  private String config(String name) {
    return env.getProperty(name, "");
  }

  private void configured(String... names) {
    for (String name : names)
      if (config(name).isBlank())
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "paymentUnavailable");
  }

  private String origin() {
    configured("PUBLIC_URL");
    String url = config("PUBLIC_URL");
    require(url.startsWith("https://") || url.startsWith("http://localhost:"), "invalidFields");
    return url.replaceAll("/$", "");
  }

  private RestClient paypal() {
    configured("PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET");
    String host =
        config("PAYPAL_LIVE").equals("true")
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";
    RestClient client = RestClient.builder().baseUrl(host).build();
    JsonNode token =
        client
            .post()
            .uri("/v1/oauth2/token")
            .headers(
                h -> h.setBasicAuth(config("PAYPAL_CLIENT_ID"), config("PAYPAL_CLIENT_SECRET")))
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body("grant_type=client_credentials")
            .retrieve()
            .body(JsonNode.class);
    return RestClient.builder()
        .baseUrl(host)
        .defaultHeader("Authorization", "Bearer " + token.path("access_token").asText())
        .build();
  }

  private void attempt(String ref, String invoice, String provider) {
    db.update(
        "INSERT INTO checkout_attempts(reference,invoice_id,provider,created_at) VALUES(?,?,?,?)",
        ref,
        invoice,
        provider,
        Instant.now().toString());
  }

  static String sha(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  @PostMapping("/invoices/{id}/checkout")
  Map<String, String> checkout(
      Principal p, @PathVariable String id, @RequestBody Map<String, Object> d) {
    var r = service.get(api.user(p), "invoices", id);
    require(!text(r.data(), "status").equals("paid"), "alreadyPaid");
    String method = text(d, "method"), locale = text(d, "locale").equals("en") ? "en" : "es";
    if (method.equals("PSE")) {
      configured("WOMPI_PUBLIC_KEY", "WOMPI_INTEGRITY_SECRET");
      require(text(r.data(), "currency").equals("COP"), "paymentCurrency");
      String ref = UUID.randomUUID().toString(),
          cents = new BigDecimal(text(r.data(), "amount")).movePointRight(2).toPlainString();
      attempt(ref, id, "wompi");
      return Map.of(
          "url",
          "https://checkout.wompi.co/p/?public-key="
              + encode(config("WOMPI_PUBLIC_KEY"))
              + "&currency=COP&amount-in-cents="
              + cents
              + "&reference="
              + ref
              + "&signature%3Aintegrity="
              + sha(ref + cents + "COP" + config("WOMPI_INTEGRITY_SECRET"))
              + "&redirect-url="
              + encode(origin() + "/" + locale + "/workspace"));
    }
    if (method.equals("PayPal")) {
      require(Set.of("USD", "EUR", "GBP").contains(text(r.data(), "currency")), "paymentCurrency");
      String returnUrl = origin() + "/" + locale + "/workspace?paypalInvoice=" + id;
      JsonNode order =
          paypal()
              .post()
              .uri("/v2/checkout/orders")
              .header("PayPal-Request-Id", UUID.randomUUID().toString())
              .contentType(MediaType.APPLICATION_JSON)
              .body(
                  Map.of(
                      "intent",
                      "CAPTURE",
                      "purchase_units",
                      List.of(
                          Map.of(
                              "reference_id",
                              id,
                              "custom_id",
                              id,
                              "amount",
                              Map.of(
                                  "currency_code",
                                  r.data().get("currency"),
                                  "value",
                                  r.data().get("amount")))),
                      "payment_source",
                      Map.of(
                          "paypal",
                          Map.of(
                              "experience_context",
                              Map.of(
                                  "return_url",
                                  returnUrl,
                                  "cancel_url",
                                  origin() + "/" + locale + "/workspace",
                                  "user_action",
                                  "PAY_NOW")))))
              .retrieve()
              .body(JsonNode.class);
      attempt(order.path("id").asText(), id, "paypal");
      for (var link : order.path("links"))
        if (Set.of("approve", "payer-action").contains(link.path("rel").asText()))
          return Map.of("url", link.path("href").asText());
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "requestFailed");
    }
    if (method.equals("Llave")) {
      configured("LLAVE_KEY", "LLAVE_BENEFICIARY");
      return Map.of(
          "instructions",
          config("LLAVE_BENEFICIARY") + " · " + config("LLAVE_KEY"),
          "reference",
          id);
    }
    if (method.equals("Wise Business")) {
      configured("WISE_PAYMENT_URL");
      String url = config("WISE_PAYMENT_URL");
      require(url.startsWith("https://wise.com/"), "invalidFields");
      return Map.of("url", url);
    }
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalidFields");
  }

  @PostMapping("/invoices/{id}/paypal-capture")
  @Transactional
  Map<String, Boolean> capture(
      Principal p, @PathVariable String id, @RequestBody Map<String, Object> d) {
    var u = api.user(p);
    var invoice = service.get(u, "invoices", id);
    db.queryForObject("SELECT id FROM records WHERE id=? FOR UPDATE", String.class, id);
    invoice = service.get(u, "invoices", id);
    if (text(invoice.data(), "status").equals("paid")) return Map.of("ok", true);
    String token = text(d, "token");
    require(token.matches("[A-Za-z0-9]+"), "invalidFields");
    require(
        db.queryForObject(
                "SELECT COUNT(*) FROM checkout_attempts WHERE reference=? AND invoice_id=? AND"
                    + " provider='paypal'",
                Integer.class,
                token,
                id)
            == 1,
        "invalidFields");
    JsonNode order =
        paypal().get().uri("/v2/checkout/orders/" + token).retrieve().body(JsonNode.class);
    if (!order.path("status").asText().equals("COMPLETED"))
      order =
          paypal()
              .post()
              .uri("/v2/checkout/orders/" + token + "/capture")
              .header("PayPal-Request-Id", "capture-" + token)
              .contentType(MediaType.APPLICATION_JSON)
              .body(Map.of())
              .retrieve()
              .body(JsonNode.class);
    JsonNode unit = order.path("purchase_units").path(0),
        capture = unit.path("payments").path("captures").path(0);
    require(
        order.path("status").asText().equals("COMPLETED")
            && capture.path("status").asText().equals("COMPLETED")
            && unit.path("custom_id").asText().equals(id),
        "paymentUnconfirmed");
    verifyAmount(
        invoice,
        capture.path("amount").path("value").asText(),
        capture.path("amount").path("currency_code").asText());
    settleVerified(id, "paypal:" + capture.path("id").asText());
    return Map.of("ok", true);
  }

  private void verifyAmount(RecordData invoice, String amount, String currency) {
    require(
        currency.equals(text(invoice.data(), "currency"))
            && new BigDecimal(amount).compareTo(new BigDecimal(text(invoice.data(), "amount")))
                == 0,
        "paymentUnconfirmed");
  }

  private Account admin() {
    return accounts.all().stream()
        .filter(Account::admin)
        .findFirst()
        .orElseThrow(
            () -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "unavailable"));
  }

  private void settleVerified(String id, String ref) {
    db.queryForObject("SELECT id FROM records WHERE id=? FOR UPDATE", String.class, id);
    if (db.queryForObject("SELECT COUNT(*) FROM payments WHERE reference=?", Integer.class, ref)
        > 0) return;
    var r = service.get(admin(), "invoices", id);
    if (text(r.data(), "status").equals("paid")) return;
    db.update(
        "INSERT INTO payments(reference,invoice_id,created_at) VALUES(?,?,?)",
        ref,
        id,
        Instant.now().toString());
    service.settle(admin(), id, ref);
  }

  @PostMapping("/webhooks/wompi")
  @Transactional
  Map<String, Boolean> wompi(@RequestBody JsonNode event) {
    configured("WOMPI_EVENTS_SECRET", "WOMPI_PRIVATE_KEY");
    StringBuilder message = new StringBuilder();
    for (JsonNode property : event.path("signature").path("properties")) {
      JsonNode value = event.path("data");
      for (String part : property.asText().split("\\.")) value = value.path(part);
      require(value.isValueNode(), "invalidFields");
      message.append(value.asText());
    }
    message.append(event.path("timestamp").asText()).append(config("WOMPI_EVENTS_SECRET"));
    require(
        MessageDigest.isEqual(
            sha(message.toString()).getBytes(StandardCharsets.UTF_8),
            event
                .path("signature")
                .path("checksum")
                .asText()
                .toLowerCase(Locale.ROOT)
                .getBytes(StandardCharsets.UTF_8)),
        "paymentUnconfirmed");
    if (!event.path("event").asText().equals("transaction.updated")) return Map.of("ok", true);
    String txId = event.path("data").path("transaction").path("id").asText();
    require(txId.matches("[a-zA-Z0-9-]+"), "invalidFields");
    String host =
        config("WOMPI_LIVE").equals("true")
            ? "https://production.wompi.co/v1"
            : "https://sandbox.wompi.co/v1";
    JsonNode tx =
        RestClient.create(host)
            .get()
            .uri("/transactions/" + txId)
            .header("Authorization", "Bearer " + config("WOMPI_PRIVATE_KEY"))
            .retrieve()
            .body(JsonNode.class)
            .path("data");
    if (!tx.path("status").asText().equals("APPROVED")) return Map.of("ok", true);
    var matches =
        db.queryForList(
            "SELECT invoice_id FROM checkout_attempts WHERE reference=? AND provider='wompi'",
            String.class,
            tx.path("reference").asText());
    require(matches.size() == 1, "invalidFields");
    String id = matches.getFirst();
    verifyAmount(
        service.get(admin(), "invoices", id),
        new BigDecimal(tx.path("amount_in_cents").asText()).movePointLeft(2).toPlainString(),
        tx.path("currency").asText());
    settleVerified(id, "wompi:" + txId);
    return Map.of("ok", true);
  }

  @PostMapping("/webhooks/bank")
  @Transactional
  Map<String, Boolean> bank(
      @RequestBody String body,
      @RequestHeader("X-AB-Timestamp") String timestamp,
      @RequestHeader("X-AB-Signature") String signature)
      throws Exception {
    configured("BANK_WEBHOOK_SECRET");
    require(config("BANK_WEBHOOK_SECRET").length() >= 32, "paymentUnavailable");
    long seconds;
    try {
      seconds = Long.parseLong(timestamp);
    } catch (NumberFormatException e) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalidFields");
    }
    require(Math.abs(Instant.now().getEpochSecond() - seconds) <= 300, "paymentUnconfirmed");
    var mac = javax.crypto.Mac.getInstance("HmacSHA256");
    mac.init(
        new javax.crypto.spec.SecretKeySpec(
            config("BANK_WEBHOOK_SECRET").getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
    String expected =
        HexFormat.of()
            .formatHex(mac.doFinal((timestamp + "." + body).getBytes(StandardCharsets.UTF_8)));
    require(
        MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            signature.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8)),
        "paymentUnconfirmed");
    JsonNode event = json.readTree(body);
    String provider = event.path("provider").asText(),
        ref = event.path("reference").asText(),
        id = event.path("invoiceId").asText();
    require(
        Set.of("llave", "wise").contains(provider)
            && event.path("status").asText().equals("completed")
            && ref.matches("[a-zA-Z0-9._-]{4,120}"),
        "invalidFields");
    verifyAmount(
        service.get(admin(), "invoices", id),
        event.path("amount").asText(),
        event.path("currency").asText());
    settleVerified(id, provider + ":" + ref);
    return Map.of("ok", true);
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String, String>> error(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(Map.of("error", Objects.toString(e.getReason(), "requestFailed")));
  }

  @ExceptionHandler(org.springframework.web.client.RestClientException.class)
  ResponseEntity<Map<String, String>> providerError(Exception e) {
    return ResponseEntity.status(502).body(Map.of("error", "paymentUnconfirmed"));
  }
}
