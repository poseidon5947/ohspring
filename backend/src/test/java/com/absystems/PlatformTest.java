package com.absystems;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.absystems.adapter.Accounts;
import com.absystems.application.PlatformService;
import com.absystems.domain.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
    properties = {
      "spring.datasource.url=${TEST_DATABASE_URL:jdbc:h2:mem:test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE}",
      "spring.datasource.username=${TEST_DATABASE_USER:sa}",
      "spring.datasource.password=${TEST_DATABASE_PASSWORD:}",
      "server.servlet.session.cookie.secure=false",
      "BANK_WEBHOOK_SECRET=test-only-bank-secret-at-least-32-characters"
    })
@AutoConfigureMockMvc
@Transactional
class PlatformTest {
  @Autowired Accounts accounts;
  @Autowired PlatformService service;
  @Autowired MockMvc mvc;
  Account admin, customer, other, employee;

  @BeforeEach
  void setup() {
    admin = accounts.create("admin@test.co", "Admin", "long-password-123", "ADMIN");
    customer = accounts.create("client@test.co", "Client", "long-password-123", "CUSTOMER");
    other = accounts.create("other@test.co", "Other", "long-password-123", "CUSTOMER");
    employee = accounts.create("staff@test.co", "Staff", "long-password-123", "EMPLOYEE");
  }

  Map<String, Object> ticket() {
    return new HashMap<>(
        Map.of(
            "title",
            "Broken display",
            "description",
            "Display is not working",
            "category",
            "hardware",
            "priority",
            "high"));
  }

  @Test
  void customersCannotReadEachOthersTickets() {
    var t = service.create(customer, "tickets", ticket());
    assertEquals(0, service.list(other, "tickets").size());
    assertThrows(Exception.class, () -> service.get(other, "tickets", t.id()));
    assertThrows(
        Exception.class,
        () -> service.update(customer, "tickets", t.id(), Map.of("status", "closed")));
  }

  @Test
  void staffReplyNotifiesCustomerAndRecordsResponseTime() {
    var t = service.create(customer, "tickets", ticket());
    service.create(
        employee, "replies", Map.of("ticketId", t.id(), "message", "We are reviewing this."));
    assertEquals(1, service.list(customer, "notifications").size());
    assertNotNull(service.get(customer, "tickets", t.id()).data().get("firstResponseAt"));
  }

  @Test
  void paymentCreatesOneLedgerEntryAndCannotBeRepeated() {
    var invoice =
        service.create(
            admin,
            "invoices",
            Map.of(
                "title",
                "Repair",
                "customerId",
                customer.id(),
                "service",
                "hardware",
                "amount",
                "120.00",
                "currency",
                "USD",
                "dueDate",
                "2026-01-01"));
    assertEquals("overdue", service.list(customer, "invoices").getFirst().data().get("status"));
    service.settle(admin, invoice.id(), "bank-reference");
    assertEquals(1, service.list(admin, "ledger").size());
    assertThrows(Exception.class, () -> service.settle(admin, invoice.id(), "again"));
    assertEquals(0, service.list(employee, "ledger").size());
  }

  @Test
  void timeAndProjectsAreScoped() {
    var project =
        service.create(
            admin,
            "projects",
            Map.of(
                "title",
                "Website",
                "customerId",
                customer.id(),
                "assigneeId",
                employee.id(),
                "dueDate",
                "2027-01-01"));
    assertEquals(1, service.list(employee, "projects").size());
    assertEquals(0, service.list(customer, "projects").size());
    var t = service.create(employee, "time", Map.of("title", "Build", "projectId", project.id()));
    assertThrows(
        Exception.class, () -> service.create(employee, "time", Map.of("title", "Duplicate")));
    assertEquals(
        "completed", service.update(employee, "time", t.id(), Map.of()).data().get("status"));
  }

  @Test
  void anonymousApiAndCsrfAreEnforced() throws Exception {
    mvc.perform(get("/api/records/tickets")).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/auth/register").contentType("application/json").content("{}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void registrationCannotEscalateRole() throws Exception {
    mvc.perform(
            post("/api/auth/register")
                .with(csrf())
                .contentType("application/json")
                .content(
                    "{\"email\":\"new@test.co\",\"name\":\"New\",\"password\":\"long-password-123\",\"role\":\"ADMIN\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.role").value("CUSTOMER"));
  }

  @Test
  void customerCannotCreateInvoice() throws Exception {
    mvc.perform(
            post("/api/records/invoices")
                .with(user(customer.email()).roles("CUSTOMER"))
                .with(csrf())
                .contentType("application/json")
                .content("{}"))
        .andExpect(status().isForbidden());
  }

  @Test
  void unconfiguredPaymentDoesNotPretendToSucceed() throws Exception {
    var inv =
        service.create(
            admin,
            "invoices",
            Map.of(
                "title",
                "Service",
                "customerId",
                customer.id(),
                "service",
                "software",
                "amount",
                "20.00",
                "currency",
                "USD",
                "dueDate",
                "2027-01-01"));
    mvc.perform(
            post("/api/invoices/" + inv.id() + "/checkout")
                .with(user(customer.email()))
                .with(csrf())
                .contentType("application/json")
                .content("{\"method\":\"PayPal\",\"locale\":\"en\"}"))
        .andExpect(status().isServiceUnavailable());
    assertEquals("pending", service.get(customer, "invoices", inv.id()).data().get("status"));
  }

  @Test
  void bankWebhookRejectsForgeryAndReconcilesOnlyOnce() throws Exception {
    var inv =
        service.create(
            admin,
            "invoices",
            Map.of(
                "title",
                "Repair",
                "customerId",
                customer.id(),
                "service",
                "hardware",
                "amount",
                "100.00",
                "currency",
                "COP",
                "dueDate",
                "2027-01-01"));
    String body =
        "{\"provider\":\"llave\",\"reference\":\"test-payment-123\",\"status\":\"completed\",\"invoiceId\":\""
            + inv.id()
            + "\",\"amount\":\"100.00\",\"currency\":\"COP\"}";
    String timestamp = Long.toString(java.time.Instant.now().getEpochSecond());
    mvc.perform(
            post("/api/webhooks/bank")
                .header("X-AB-Timestamp", timestamp)
                .header("X-AB-Signature", "forged")
                .contentType("application/json")
                .content(body))
        .andExpect(status().isBadRequest());
    var mac = javax.crypto.Mac.getInstance("HmacSHA256");
    mac.init(
        new javax.crypto.spec.SecretKeySpec(
            "test-only-bank-secret-at-least-32-characters"
                .getBytes(java.nio.charset.StandardCharsets.UTF_8),
            "HmacSHA256"));
    String signature =
        java.util.HexFormat.of()
            .formatHex(
                mac.doFinal(
                    (timestamp + "." + body).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    for (int i = 0; i < 2; i++)
      mvc.perform(
              post("/api/webhooks/bank")
                  .header("X-AB-Timestamp", timestamp)
                  .header("X-AB-Signature", signature)
                  .contentType("application/json")
                  .content(body))
          .andExpect(status().isOk());
    assertEquals("paid", service.get(customer, "invoices", inv.id()).data().get("status"));
    assertEquals(1, service.list(admin, "ledger").size());
  }

  @Test
  void clientsCannotInjectSystemFields() {
    var data = ticket();
    data.put("firstResponseAt", "2020-01-01T00:00:00Z");
    assertThrows(
        org.springframework.web.server.ResponseStatusException.class,
        () -> service.create(customer, "tickets", data));
    assertEquals(0, service.list(customer, "tickets").size());
  }
}
