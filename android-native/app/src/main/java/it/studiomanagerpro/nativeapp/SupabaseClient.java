package it.studiomanagerpro.nativeapp;

import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class SupabaseClient {
    public static final String BASE = "https://ngeltlygytupgdjiagve.supabase.co";
    public static final String KEY = "sb_publishable_w5pmFJOsxUmHL6L6xFWAfQ_3Fq9vUAB";

    public static JSONObject login(String email, String password) throws Exception {
        JSONObject body = new JSONObject().put("email", email).put("password", password);
        return requestObject("POST", BASE + "/auth/v1/token?grant_type=password", null, body.toString());
    }

    public static JSONArray select(String token, String table, String query) throws Exception {
        String url = BASE + "/rest/v1/" + table + "?" + query;
        String raw = requestRaw("GET", url, token, null, null);
        return new JSONArray(raw);
    }

    public static JSONObject upsert(String token, String table, JSONObject body) throws Exception {
        String url = BASE + "/rest/v1/" + table + "?on_conflict=utente_id,data_presenza";
        String raw = requestRaw("POST", url, token, body.toString(), "resolution=merge-duplicates,return=representation");
        JSONArray arr = new JSONArray(raw);
        return arr.length() > 0 ? arr.getJSONObject(0) : body;
    }

    private static JSONObject requestObject(String method, String url, String token, String body) throws Exception {
        return new JSONObject(requestRaw(method, url, token, body, null));
    }

    private static String requestRaw(String method, String url, String token, String body, String prefer) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setRequestProperty("apikey", KEY);
        c.setRequestProperty("Accept", "application/json");
        if (token != null && !token.isEmpty()) c.setRequestProperty("Authorization", "Bearer " + token);
        if (prefer != null) c.setRequestProperty("Prefer", prefer);
        if (body != null) {
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            try (OutputStream os = c.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int code = c.getResponseCode();
        InputStream is = code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream();
        StringBuilder sb = new StringBuilder();
        if (is != null) try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line; while ((line = br.readLine()) != null) sb.append(line);
        }
        String raw = sb.toString();
        if (code < 200 || code >= 300) throw new IOException("HTTP " + code + ": " + raw);
        return raw.isEmpty() ? "{}" : raw;
    }

    public static String eq(String value) {
        return Uri.encode(value == null ? "" : value);
    }
}
