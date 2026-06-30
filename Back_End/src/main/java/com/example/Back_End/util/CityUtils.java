package com.example.Back_End.util;

import java.text.Normalizer;

public final class CityUtils {

    private CityUtils() {}

    /**
     * Normalizes a Vietnamese city name to an ASCII slug for fuzzy matching.
     * "TP. Hồ Chí Minh" → "ho chi minh"
     * "Đà Nẵng"         → "da nang"
     * "Hà Nội"          → "ha noi"
     */
    public static String normalize(String city) {
        if (city == null || city.isBlank()) return "";

        String s = city.trim().toLowerCase();

        // đ/Đ doesn't decompose in NFD — replace explicitly
        s = s.replace('đ', 'd');

        // NFD decomposition separates base letters from combining diacritic marks
        s = Normalizer.normalize(s, Normalizer.Form.NFD);

        // Remove all combining diacritic marks (accents, tones, etc.)
        s = s.replaceAll("[\\p{M}]", "");

        // Remove non-alphanumeric characters (dots, dashes, etc.)
        s = s.replaceAll("[^a-z0-9\\s]", " ");

        // Strip common Vietnamese administrative prefixes so
        // "TP. Hồ Chí Minh" and "Hồ Chí Minh" both normalize to "ho chi minh"
        s = s.replaceAll("^(tp|thanh pho|tinh|quan|huyen|xa)\\s+", "");

        return s.trim().replaceAll("\\s+", " ");
    }
}
