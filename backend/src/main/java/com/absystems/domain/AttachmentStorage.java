package com.absystems.domain;

public interface AttachmentStorage {
  String put(String key, byte[] content, String type);

  byte[] read(String reference);
}
