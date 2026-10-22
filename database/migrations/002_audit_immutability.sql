-- TrustVault Migration 002: Audit Log Immutability Protection
-- PostgreSQL Trigger preventing any UPDATE or DELETE operations on audit_log

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        RAISE EXCEPTION 'Security Violation: audit_log records are strictly immutable and cannot be updated (Sequence: %)', OLD.sequence_number;
    ELSIF (TG_OP = 'DELETE') THEN
        RAISE EXCEPTION 'Security Violation: audit_log records are strictly immutable and cannot be deleted (Sequence: %)', OLD.sequence_number;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;

CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();
