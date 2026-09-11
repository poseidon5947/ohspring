package com.absystems.adapter;

import com.absystems.domain.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcRecordStore implements RecordStore {
  private final JdbcTemplate db;
  private final ObjectMapper json;

  public JdbcRecordStore(JdbcTemplate db, ObjectMapper json) {
    this.db = db;
    this.json = json;
  }

  private RecordData read(java.sql.ResultSet r) throws java.sql.SQLException {
    try {
      return new RecordData(
          r.getString("id"),
          r.getString("module"),
          r.getString("owner_id"),
          r.getString("assignee_id"),
          json.readValue(r.getString("payload"), new TypeReference<Map<String, Object>>() {}),
          r.getString("created_at"),
          r.getString("updated_at"));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  public List<RecordData> list(String module) {
    return db.query(
        "SELECT * FROM records WHERE module=? ORDER BY created_at DESC", (r, n) -> read(r), module);
  }

  public void lock(String id) {
    db.queryForObject("SELECT id FROM records WHERE id=? FOR UPDATE", String.class, id);
  }

  public RecordData get(String id) {
    return db.query("SELECT * FROM records WHERE id=?", (r, n) -> read(r), id).stream()
        .findFirst()
        .orElse(null);
  }

  public void save(RecordData r) {
    try {
      String payload = json.writeValueAsString(r.data());
      int n =
          db.update(
              "UPDATE records SET owner_id=?,assignee_id=?,payload=?,updated_at=? WHERE id=?",
              r.ownerId(),
              r.assigneeId(),
              payload,
              r.updatedAt(),
              r.id());
      if (n == 0)
        db.update(
            "INSERT INTO records(id,module,owner_id,assignee_id,payload,created_at,updated_at)"
                + " VALUES(?,?,?,?,?,?,?)",
            r.id(),
            r.module(),
            r.ownerId(),
            r.assigneeId(),
            payload,
            r.createdAt(),
            r.updatedAt());
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }
}
