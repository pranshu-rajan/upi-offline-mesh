package com.demo.upimesh.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;
import java.sql.Connection;
import java.sql.DriverManager;

/**
 * Resilient DataSource configuration.
 *
 * Automatically verifies connectivity to the configured production database (e.g. Supabase PostgreSQL).
 * Supports both standard JDBC URLs (jdbc:postgresql://...) and direct URIs (postgresql://user:pass@host:port/db).
 * If the remote database is unreachable, paused, or invalid credentials are provided, it logs
 * an actionable diagnostic banner and gracefully falls back to an embedded in-memory H2 database
 * in PostgreSQL compatibility mode.
 *
 * This guarantees zero-downtime deployment on platforms like Render even if the remote DB is paused.
 */
@Configuration
public class DataSourceConfig {

    private static final Logger log = LoggerFactory.getLogger(DataSourceConfig.class);

    @Value("${spring.datasource.url:jdbc:h2:mem:upimesh;DB_CLOSE_DELAY=-1}")
    private String rawUrl;

    @Value("${spring.datasource.username:sa}")
    private String rawUsername;

    @Value("${spring.datasource.password:}")
    private String rawPassword;

    @Value("${spring.datasource.driver-class-name:}")
    private String driverClassName;

    @Bean
    @Primary
    public DataSource dataSource() {
        ParsedDbConfig parsed = parseConnectionInfo(rawUrl, rawUsername, rawPassword);

        if (parsed.jdbcUrl != null && parsed.jdbcUrl.startsWith("jdbc:postgresql:")) {
            log.info("Testing connection to PostgreSQL database at: {}", maskUrl(parsed.jdbcUrl));
            try {
                // Test connectivity with a fast 5-second login timeout
                DriverManager.setLoginTimeout(5);
                try (Connection conn = DriverManager.getConnection(parsed.jdbcUrl, parsed.username, parsed.password)) {
                    log.info("Successfully connected to PostgreSQL database! Initializing production Hikari pool.");
                    HikariConfig config = new HikariConfig();
                    config.setJdbcUrl(parsed.jdbcUrl);
                    config.setUsername(parsed.username);
                    config.setPassword(parsed.password);
                    if (driverClassName != null && !driverClassName.isBlank()) {
                        config.setDriverClassName(driverClassName);
                    } else {
                        config.setDriverClassName("org.postgresql.Driver");
                    }
                    config.setMaximumPoolSize(10);
                    config.setMinimumIdle(2);
                    config.setConnectionTimeout(15000);
                    config.setPoolName("HikariPool-Postgres-Supabase");
                    return new HikariDataSource(config);
                }
            } catch (Exception e) {
                log.error("\n"
                        + "====================================================================================\n"
                        + "⚠️  REMOTE POSTGRESQL / SUPABASE CONNECTION FAILED\n"
                        + "    Target URL: {}\n"
                        + "    Root Cause: {}\n"
                        + "\n"
                        + "    Common causes:\n"
                        + "    1. Supabase project is PAUSED (Visit https://app.supabase.com and click 'Restore')\n"
                        + "    2. The Supabase tenant/user in Render Environment Variables is stale or deleted\n"
                        + "    3. Incorrect password or network IP restriction on the database\n"
                        + "\n"
                        + "🔄  SELF-HEALING FALLBACK: Switching to in-memory H2 (PostgreSQL compatibility mode).\n"
                        + "    Your Render service will remain ONLINE and accept mesh traffic.\n"
                        + "    Update your Render SPRING_DATASOURCE_URL when your Supabase project is active.\n"
                        + "====================================================================================",
                        maskUrl(parsed.jdbcUrl), e.getMessage());
                return createH2Fallback();
            }
        }

        // Default or explicitly configured H2
        return createH2Fallback();
    }

    private ParsedDbConfig parseConnectionInfo(String url, String username, String password) {
        if (url == null || url.isBlank()) {
            return new ParsedDbConfig("jdbc:h2:mem:upimesh;DB_CLOSE_DELAY=-1;MODE=PostgreSQL", "sa", "");
        }

        String targetUrl = url.trim();
        String targetUser = username;
        String targetPass = password;

        // If the user pasted postgresql://user:password@host:port/db (standard URI format)
        if (targetUrl.startsWith("postgresql://")) {
            try {
                URI uri = URI.create(targetUrl);
                String userInfo = uri.getUserInfo();
                if (userInfo != null && !userInfo.isBlank()) {
                    String[] userParts = userInfo.split(":", 2);
                    targetUser = userParts[0];
                    if (userParts.length > 1) {
                        targetPass = userParts[1];
                    }
                }
                String host = uri.getHost();
                int port = uri.getPort() == -1 ? 5432 : uri.getPort();
                String path = uri.getPath() == null ? "/postgres" : uri.getPath();
                String query = uri.getQuery();

                StringBuilder jdbc = new StringBuilder("jdbc:postgresql://")
                        .append(host).append(":").append(port).append(path);

                if (query != null && !query.isBlank()) {
                    jdbc.append("?").append(query);
                    if (!query.contains("sslmode=")) {
                        jdbc.append("&sslmode=require");
                    }
                } else {
                    jdbc.append("?sslmode=require");
                }
                targetUrl = jdbc.toString();
            } catch (Exception ex) {
                targetUrl = "jdbc:" + targetUrl;
            }
        } else if (targetUrl.startsWith("jdbc:postgresql:") && targetUrl.contains("supabase.co") && !targetUrl.contains("sslmode=")) {
            targetUrl += (targetUrl.contains("?") ? "&" : "?") + "sslmode=require";
        }

        return new ParsedDbConfig(targetUrl, targetUser, targetPass);
    }

    private DataSource createH2Fallback() {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:upimesh;DB_CLOSE_DELAY=-1;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE");
        config.setUsername("sa");
        config.setPassword("");
        config.setDriverClassName("org.h2.Driver");
        config.setMaximumPoolSize(10);
        config.setPoolName("HikariPool-H2-Fallback");
        return new HikariDataSource(config);
    }

    private String maskUrl(String rawUrl) {
        if (rawUrl == null) return "null";
        return rawUrl.replaceAll(":[^:@]+@", ":****@");
    }

    private static class ParsedDbConfig {
        final String jdbcUrl;
        final String username;
        final String password;

        ParsedDbConfig(String jdbcUrl, String username, String password) {
            this.jdbcUrl = jdbcUrl;
            this.username = username;
            this.password = password;
        }
    }
}
