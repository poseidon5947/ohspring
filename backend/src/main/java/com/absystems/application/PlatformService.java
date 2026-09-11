package com.absystems.application;

import com.absystems.domain.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PlatformService {
  private final RecordStore store;
  private final AccountDirectory accounts;
  public static final Set<String> MODULES =
      Set.of(
          "tickets",
          "replies",
          "notifications",
          "leads",
          "interactions",
          "projects",
          "tasks",
          "time",
          "invoices",
          "ledger",
          "audit");

  public PlatformService(RecordStore store, AccountDirectory accounts) {
    this.store = store;
    this.accounts = accounts;
  }

  public static void require(boolean condition, String code) {
    if (!condition) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, code);
  }

  public static void forbidden() {
    throw new ResponseStatusException(HttpStatus.FORBIDDEN, "forbidden");
  }

  public static String text(Map<String, Object> d, String k) {
    return Objects.toString(d.get(k), "").trim();
  }

  public static void required(Map<String, Object> d, String... keys) {
    for (String k : keys)
      require(!text(d, k).isEmpty() && text(d, k).length() <= 5000, "invalidFields");
  }

  private boolean visible(Account a, RecordData r) {
    if (a.admin()) return true;
    return switch (r.module()) {
      case "tickets" -> a.staff() || a.id().equals(r.ownerId());
      case "replies" -> {
        var parent = store.get(text(r.data(), "ticketId"));
        yield parent != null && visible(a, parent);
      }
      case "notifications", "time" -> a.id().equals(r.ownerId());
      case "invoices" -> !a.staff() && a.id().equals(r.ownerId());
      case "projects" -> a.staff() && a.id().equals(r.assigneeId());
      case "tasks" -> {
        var p = store.get(text(r.data(), "projectId"));
        yield a.staff() && (a.id().equals(r.assigneeId()) || (p != null && visible(a, p)));
      }
      case "leads", "interactions" -> a.staff() && a.crmAccess();
      default -> false;
    };
  }

  public List<RecordData> list(Account a, String module) {
    require(MODULES.contains(module), "invalidModule");
    return store.list(module).stream().filter(r -> visible(a, r)).map(this::derived).toList();
  }

  private RecordData derived(RecordData r) {
    if (r.module().equals("invoices")
        && text(r.data(), "status").equals("pending")
        && LocalDate.parse(text(r.data(), "dueDate")).isBefore(LocalDate.now())) {
      var d = new HashMap<>(r.data());
      d.put("status", "overdue");
      return new RecordData(
          r.id(), r.module(), r.ownerId(), r.assigneeId(), d, r.createdAt(), r.updatedAt());
    }
    return r;
  }

  public RecordData get(Account a, String module, String id) {
    var r = store.get(id);
    if (r == null || !r.module().equals(module))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "notFound");
    if (!visible(a, r)) forbidden();
    return derived(r);
  }

  private RecordData insert(String module, String owner, String assignee, Map<String, Object> d) {
    String now = Instant.now().toString();
    var r =
        new RecordData(
            UUID.randomUUID().toString(), module, owner, assignee, Map.copyOf(d), now, now);
    store.save(r);
    return r;
  }

  private void audit(Account a, String action, String id) {
    insert("audit", a.id(), null, Map.of("title", action, "recordId", id, "actor", a.email()));
  }

  private void notify(String owner, String title, String ticketId) {
    insert(
        "notifications",
        owner,
        null,
        Map.of("title", title, "ticketId", ticketId, "status", "unread"));
  }

  private String linkedCustomer(Map<String, Object> d) {
    required(d, "customerId");
    Account customer = accounts.id(text(d, "customerId"));
    require(!customer.staff(), "invalidCustomer");
    return customer.id();
  }

  private String assignee(Map<String, Object> d) {
    String id = text(d, "assigneeId");
    if (id.isBlank()) return null;
    require(accounts.id(id).staff(), "invalidAssignee");
    return id;
  }

  private void choice(Map<String, Object> d, String key, String fallback, String... values) {
    d.putIfAbsent(key, fallback);
    require(Set.of(values).contains(text(d, key)), "invalidFields");
  }

  private void date(Map<String, Object> d, String key) {
    required(d, key);
    try {
      LocalDate.parse(text(d, key));
    } catch (Exception e) {
      require(false, "invalidDate");
    }
  }

  private void amount(Map<String, Object> d) {
    try {
      BigDecimal value = new BigDecimal(text(d, "amount"));
      require(
          value.signum() > 0
              && value.scale() <= 2
              && value.compareTo(new BigDecimal("1000000000000")) < 0,
          "invalidAmount");
      d.put("amount", value.toPlainString());
    } catch (NumberFormatException e) {
      require(false, "invalidAmount");
    }
    choice(d, "currency", "COP", "COP", "USD", "EUR", "GBP");
  }

  @Transactional
  public RecordData create(Account a, String module, Map<String, Object> input) {
    require(MODULES.contains(module), "invalidModule");
    Set<String> permitted =
        switch (module) {
          case "tickets" ->
              Set.of("title", "description", "category", "priority", "customerId", "assigneeId");
          case "replies" -> Set.of("ticketId", "message");
          case "leads" -> Set.of("title", "email", "description", "service", "status");
          case "interactions" -> Set.of("title", "description", "leadId", "ticketId", "type");
          case "projects" ->
              Set.of(
                  "title",
                  "description",
                  "customerId",
                  "ticketId",
                  "assigneeId",
                  "dueDate",
                  "status");
          case "tasks" -> Set.of("title", "projectId", "assigneeId", "dueDate", "status");
          case "time" -> Set.of("title", "type", "projectId", "ticketId");
          case "invoices" ->
              Set.of(
                  "title",
                  "customerId",
                  "service",
                  "amount",
                  "currency",
                  "dueDate",
                  "projectId",
                  "ticketId");
          case "ledger" ->
              Set.of("title", "customerId", "service", "type", "amount", "currency", "date");
          default -> Set.of();
        };
    require(permitted.containsAll(input.keySet()), "invalidFields");
    require(
        input.values().stream()
            .allMatch(
                v -> (v instanceof String && ((String) v).length() <= 5000) || v instanceof Number),
        "invalidFields");
    var d = new HashMap<>(input);
    require(d.size() < 30, "invalidFields");
    String owner = a.id(), assigned = null;
    switch (module) {
      case "tickets" -> {
        required(d, "title", "description");
        choice(d, "category", "support", "support", "hardware", "software", "onsite");
        choice(d, "priority", "normal", "low", "normal", "high", "urgent");
        d.put("status", "open");
        if (a.staff()) owner = linkedCustomer(d);
        if (a.staff()) assigned = assignee(d);
      }
      case "replies" -> {
        required(d, "ticketId", "message");
        var t = get(a, "tickets", text(d, "ticketId"));
        require(!text(t.data(), "status").equals("closed"), "ticketClosed");
        d =
            new HashMap<>(
                Map.of(
                    "ticketId",
                    t.id(),
                    "message",
                    text(d, "message"),
                    "author",
                    a.name(),
                    "staff",
                    a.staff()));
        notify(t.ownerId(), "ticketReply", t.id());
        if (a.staff() && !t.data().containsKey("firstResponseAt")) {
          var td = new HashMap<>(t.data());
          td.put("firstResponseAt", Instant.now().toString());
          store.save(
              new RecordData(
                  t.id(),
                  t.module(),
                  t.ownerId(),
                  t.assigneeId(),
                  td,
                  t.createdAt(),
                  Instant.now().toString()));
        }
      }
      case "leads" -> {
        if (!a.admin() && !a.crmAccess()) forbidden();
        required(d, "title", "email");
        choice(d, "status", "contact", "contact", "proposal", "closing", "won", "lost");
        choice(d, "service", "software", "software", "support", "hardware", "onsite");
      }
      case "interactions" -> {
        if (!a.admin() && !a.crmAccess()) forbidden();
        required(d, "leadId", "title", "description");
        get(a, "leads", text(d, "leadId"));
        if (!text(d, "ticketId").isBlank()) get(a, "tickets", text(d, "ticketId"));
        choice(d, "type", "call", "call", "email", "meeting", "ticket");
      }
      case "projects" -> {
        if (!a.admin()) forbidden();
        required(d, "title");
        owner = linkedCustomer(d);
        assigned = assignee(d);
        date(d, "dueDate");
        choice(d, "status", "pending", "pending", "in_progress", "completed");
        if (!text(d, "ticketId").isBlank()) {
          var t = get(a, "tickets", text(d, "ticketId"));
          require(owner.equals(t.ownerId()), "invalidCustomer");
        }
      }
      case "tasks" -> {
        if (!a.staff()) forbidden();
        required(d, "title", "projectId");
        get(a, "projects", text(d, "projectId"));
        assigned = assignee(d);
        date(d, "dueDate");
        choice(d, "status", "pending", "pending", "in_progress", "completed");
      }
      case "time" -> {
        if (!a.staff()) forbidden();
        accounts.lock(a.id());
        required(d, "title");
        choice(d, "type", "work", "work", "late", "leave", "sick", "overtime");
        if (!text(d, "projectId").isBlank()) get(a, "projects", text(d, "projectId"));
        if (!text(d, "ticketId").isBlank()) get(a, "tickets", text(d, "ticketId"));
        require(
            store.list("time").stream()
                .noneMatch(r -> a.id().equals(r.ownerId()) && text(r.data(), "endedAt").isBlank()),
            "alreadyClockedIn");
        d.put("startedAt", Instant.now().toString());
        d.remove("endedAt");
        d.remove("hours");
        d.put("status", "active");
      }
      case "invoices" -> {
        if (!a.admin()) forbidden();
        required(d, "title", "service");
        owner = linkedCustomer(d);
        amount(d);
        date(d, "dueDate");
        d.put("status", "pending");
        for (String key : List.of("projectId", "ticketId")) {
          if (!text(d, key).isBlank()) {
            var linked = get(a, key.equals("projectId") ? "projects" : "tickets", text(d, key));
            require(owner.equals(linked.ownerId()), "invalidCustomer");
          }
        }
        d.remove("paymentReference");
      }
      case "ledger" -> {
        if (!a.admin()) forbidden();
        required(d, "title", "service");
        amount(d);
        date(d, "date");
        choice(d, "type", "expense", "income", "expense");
        d.put("status", "posted");
        if (!text(d, "customerId").isBlank()) owner = linkedCustomer(d);
      }
      default -> forbidden();
    }
    var r = insert(module, owner, assigned, d);
    if (module.equals("ledger") || module.equals("invoices")) audit(a, "created:" + module, r.id());
    return r;
  }

  @Transactional
  public RecordData update(Account a, String module, String id, Map<String, Object> patch) {
    patch = new HashMap<>(patch);
    get(a, module, id);
    store.lock(id);
    var r = get(a, module, id);
    var d = new HashMap<>(r.data());
    String assigned = r.assigneeId();
    switch (module) {
      case "tickets" -> {
        if (!a.staff()) forbidden();
        String status = text(patch, "status");
        if (!status.isBlank()) {
          choice(patch, "status", "open", "open", "in_progress", "resolved", "closed");
          d.put("status", status);
          if (status.equals("resolved") && !d.containsKey("resolvedAt"))
            d.put("resolvedAt", Instant.now().toString());
        }
        if (patch.containsKey("assigneeId")) assigned = assignee(patch);
        if (patch.containsKey("priority")) {
          choice(patch, "priority", "normal", "low", "normal", "high", "urgent");
          d.put("priority", text(patch, "priority"));
        }
        notify(r.ownerId(), "ticketUpdated", r.id());
      }
      case "leads" -> {
        if (!a.admin() && !a.crmAccess()) forbidden();
        choice(patch, "status", "contact", "contact", "proposal", "closing", "won", "lost");
        d.put("status", text(patch, "status"));
      }
      case "projects", "tasks" -> {
        if (!a.staff()) forbidden();
        choice(patch, "status", "pending", "pending", "in_progress", "completed");
        d.put("status", text(patch, "status"));
        if (patch.containsKey("assigneeId")) assigned = assignee(patch);
      }
      case "time" -> {
        require(text(d, "endedAt").isBlank(), "alreadyClockedOut");
        String end = Instant.now().toString();
        d.put("endedAt", end);
        d.put(
            "hours",
            Duration.between(Instant.parse(text(d, "startedAt")), Instant.parse(end)).toSeconds()
                / 3600.0);
        d.put("status", "completed");
      }
      case "notifications" -> d.put("status", "read");
      default -> forbidden();
    }
    var next =
        new RecordData(
            r.id(), r.module(), r.ownerId(), assigned, d, r.createdAt(), Instant.now().toString());
    store.save(next);
    return next;
  }

  @Transactional
  public RecordData settle(Account a, String id, String reference) {
    if (!a.admin()) forbidden();
    required(Map.of("reference", reference), "reference");
    get(a, "invoices", id);
    store.lock(id);
    var r = get(a, "invoices", id);
    require(!text(r.data(), "status").equals("paid"), "alreadyPaid");
    var d = new HashMap<>(r.data());
    d.put("status", "paid");
    d.put("paymentReference", reference);
    d.put("paidAt", Instant.now().toString());
    var next =
        new RecordData(
            r.id(),
            r.module(),
            r.ownerId(),
            r.assigneeId(),
            d,
            r.createdAt(),
            Instant.now().toString());
    store.save(next);
    insert(
        "ledger",
        r.ownerId(),
        null,
        Map.of(
            "title",
            text(d, "title"),
            "invoiceId",
            id,
            "amount",
            d.get("amount"),
            "currency",
            d.get("currency"),
            "service",
            d.get("service"),
            "type",
            "income",
            "date",
            LocalDate.now().toString(),
            "status",
            "posted"));
    audit(a, "invoicePaid", id);
    return next;
  }
}
