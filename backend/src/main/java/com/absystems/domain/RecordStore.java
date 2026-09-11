package com.absystems.domain;

import java.util.*;

public interface RecordStore {
  List<RecordData> list(String module);

  RecordData get(String id);

  void lock(String id);

  void save(RecordData record);
}
