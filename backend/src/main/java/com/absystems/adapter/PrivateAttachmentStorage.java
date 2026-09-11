package com.absystems.adapter;

import com.absystems.domain.AttachmentStorage;
import java.util.Base64;
import org.springframework.core.env.Environment;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class PrivateAttachmentStorage implements AttachmentStorage {
  private final Environment env;

  public PrivateAttachmentStorage(Environment env) {
    this.env = env;
  }

  private String setting(String key) {
    return env.getProperty(key, "");
  }

  private RestClient cloud() {
    String base = setting("SUPABASE_URL"), secret = setting("SUPABASE_SERVICE_ROLE_KEY");
    if (!base.startsWith("https://") || secret.isBlank())
      throw new IllegalStateException("Storage configuration missing");
    return RestClient.builder()
        .baseUrl(base + "/storage/v1/object")
        .defaultHeader("Authorization", "Bearer " + secret)
        .defaultHeader("apikey", secret)
        .build();
  }

  public String put(String key, byte[] content, String type) {
    String bucket = setting("SUPABASE_STORAGE_BUCKET");
    if (bucket.isBlank()) return Base64.getEncoder().encodeToString(content);
    if (!bucket.matches("[a-zA-Z0-9_-]+")) throw new IllegalStateException("Invalid bucket");
    String path = bucket + "/" + key;
    cloud()
        .post()
        .uri("/" + path)
        .contentType(MediaType.parseMediaType(type))
        .body(content)
        .retrieve()
        .toBodilessEntity();
    return "supabase:" + path;
  }

  public byte[] read(String reference) {
    if (reference.startsWith("supabase:"))
      return cloud().get().uri("/" + reference.substring(9)).retrieve().body(byte[].class);
    return Base64.getDecoder().decode(reference);
  }
}
