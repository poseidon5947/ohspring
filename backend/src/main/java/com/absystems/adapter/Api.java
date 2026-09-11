package com.absystems.adapter;

import static com.absystems.application.PlatformService.*;

import com.absystems.application.PlatformService;
import com.absystems.domain.*;
import java.security.Principal;
import java.util.*;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class Api {
  private final Accounts accounts;
  private final PlatformService service;
  private final JdbcTemplate db;
  private final AttachmentStorage storage;

  public Api(Accounts a, PlatformService s, JdbcTemplate db, AttachmentStorage storage) {
    accounts = a;
    service = s;
    this.db = db;
    this.storage = storage;
  }

  Account user(Principal p) {
    if (p == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized");
    var a = accounts.email(p.getName());
    if (a == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "unauthorized");
    return a;
  }

  @GetMapping("/health")
  Map<String, String> health() {
    return Map.of("status", "ok");
  }

  @GetMapping("/csrf")
  Map<String, String> csrf(CsrfToken token) {
    return Map.of("token", token.getToken(), "headerName", token.getHeaderName());
  }

  @PostMapping("/auth/register")
  Account register(@RequestBody Map<String, Object> d) {
    return accounts.create(text(d, "email"), text(d, "name"), text(d, "password"), "CUSTOMER");
  }

  @GetMapping("/auth/me")
  Account me(Principal p) {
    return user(p);
  }

  @GetMapping("/users")
  List<Account> users(Principal p) {
    var a = user(p);
    if (!a.staff()) forbidden();
    return accounts.all().stream()
        .map(u -> a.admin() ? u : new Account(u.id(), "", u.name(), u.role(), "", "", false))
        .toList();
  }

  @PostMapping("/users")
  Account createUser(Principal p, @RequestBody Map<String, Object> d) {
    if (!user(p).admin()) forbidden();
    return accounts.create(text(d, "email"), text(d, "name"), text(d, "password"), text(d, "role"));
  }

  @PatchMapping("/users/{id}")
  Account updateUser(Principal p, @PathVariable String id, @RequestBody Map<String, Object> d) {
    if (!user(p).admin()) forbidden();
    return accounts.update(id, d);
  }

  @GetMapping("/records/{module}")
  List<RecordData> list(Principal p, @PathVariable String module) {
    return service.list(user(p), module);
  }

  @PostMapping("/records/{module}")
  RecordData create(Principal p, @PathVariable String module, @RequestBody Map<String, Object> d) {
    return service.create(user(p), module, d);
  }

  @PatchMapping("/records/{module}/{id}")
  RecordData update(
      Principal p,
      @PathVariable String module,
      @PathVariable String id,
      @RequestBody Map<String, Object> d) {
    return service.update(user(p), module, id, d);
  }

  @PostMapping("/invoices/{id}/settle")
  @org.springframework.transaction.annotation.Transactional
  RecordData settle(Principal p, @PathVariable String id, @RequestBody Map<String, Object> d) {
    var a = user(p);
    if (!a.admin()) forbidden();
    String ref = text(d, "reference");
    require(ref.length() >= 4 && ref.length() <= 180, "invalidFields");
    try {
      db.update(
          "INSERT INTO payments(reference,invoice_id,created_at) VALUES(?,?,?)",
          ref,
          id,
          java.time.Instant.now().toString());
    } catch (org.springframework.dao.DuplicateKeyException e) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "duplicatePayment");
    }
    return service.settle(a, id, ref);
  }

  @PostMapping("/contact")
  Map<String, Boolean> contact(@RequestBody Map<String, Object> d) {
    required(d, "name", "email", "message", "service");
    require(text(d, "email").matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$"), "invalidFields");
    var admins = accounts.all().stream().filter(Account::admin).toList();
    if (admins.isEmpty())
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "contactUnavailable");
    service.create(
        admins.getFirst(),
        "leads",
        Map.of(
            "title",
            text(d, "name"),
            "email",
            text(d, "email"),
            "description",
            text(d, "message"),
            "service",
            text(d, "service")));
    return Map.of("ok", true);
  }

  @PostMapping("/tickets/{id}/attachments")
  Map<String, String> upload(
      Principal p, @PathVariable String id, @RequestParam("file") MultipartFile file)
      throws Exception {
    service.get(user(p), "tickets", id);
    require(!file.isEmpty() && file.getSize() <= 5 * 1024 * 1024, "invalidFile");
    String type = Objects.toString(file.getContentType(), "");
    require(
        Set.of("image/png", "image/jpeg", "application/pdf", "text/plain").contains(type),
        "invalidFile");
    String name =
        Objects.toString(file.getOriginalFilename(), "attachment")
            .replaceAll("[^a-zA-Z0-9._ -]", "_");
    require(name.length() <= 200, "invalidFile");
    String aid = UUID.randomUUID().toString();
    db.update(
        "INSERT INTO attachments(id,ticket_id,name,media_type,content) VALUES(?,?,?,?,?)",
        aid,
        id,
        name,
        type,
        storage.put(id + "/" + aid, file.getBytes(), type));
    return Map.of("id", aid, "name", name);
  }

  @GetMapping("/tickets/{id}/attachments")
  List<Map<String, Object>> files(Principal p, @PathVariable String id) {
    service.get(user(p), "tickets", id);
    return db.queryForList("SELECT id,name FROM attachments WHERE ticket_id=?", id);
  }

  @GetMapping("/tickets/{id}/attachments/{aid}")
  ResponseEntity<byte[]> download(Principal p, @PathVariable String id, @PathVariable String aid) {
    service.get(user(p), "tickets", id);
    var files = db.queryForList("SELECT * FROM attachments WHERE id=? AND ticket_id=?", aid, id);
    if (files.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "notFound");
    var f = files.getFirst();
    return ResponseEntity.ok()
        .header(
            "Content-Disposition",
            ContentDisposition.attachment().filename(f.get("name").toString()).build().toString())
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .body(storage.read(f.get("content").toString()));
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String, String>> error(ResponseStatusException e) {
    return ResponseEntity.status(e.getStatusCode())
        .body(Map.of("error", Objects.toString(e.getReason(), "requestFailed")));
  }

  @ExceptionHandler({
    org.springframework.http.converter.HttpMessageNotReadableException.class,
    org.springframework.web.multipart.MaxUploadSizeExceededException.class
  })
  ResponseEntity<Map<String, String>> malformed(Exception e) {
    return ResponseEntity.badRequest().body(Map.of("error", "invalidFields"));
  }
}
