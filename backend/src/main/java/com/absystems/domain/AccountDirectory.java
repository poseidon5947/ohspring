package com.absystems.domain;

import java.util.List;

public interface AccountDirectory {
  Account id(String id);

  List<Account> all();

  void lock(String id);
}
