package com.absystems.domain;

import java.util.Map;

public record RecordData(
    String id,
    String module,
    String ownerId,
    String assigneeId,
    Map<String, Object> data,
    String createdAt,
    String updatedAt) {}
