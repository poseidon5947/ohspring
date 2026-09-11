package com.absystems.domain;

public record Account(
    String id,
    String email,
    String name,
    String role,
    String department,
    String position,
    boolean crmAccess) {
  public boolean admin() {
    return role.equals("ADMIN");
  }

  public boolean staff() {
    return !role.equals("CUSTOMER");
  }
}
