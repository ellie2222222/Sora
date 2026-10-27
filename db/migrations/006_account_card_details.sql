-- 006_account_card_details.sql
--
-- What tells two cards apart in a wallet: the issuing bank or e-wallet provider, the card network,
-- and the last four digits. Never the full number: four digits identify a card to its owner and
-- nothing more. All optional. Network and last four belong to a bank account's or credit card's
-- card only; an e-wallet may name its provider; cash carries none of the three.

BEGIN;

ALTER TABLE accounts
    ADD COLUMN institution_name VARCHAR(60),
    ADD COLUMN card_network     VARCHAR(20),
    ADD COLUMN card_last4       CHAR(4);

ALTER TABLE accounts
    ADD CONSTRAINT chk_account_institution_not_blank
        CHECK (institution_name IS NULL OR btrim(institution_name) <> ''),
    ADD CONSTRAINT chk_account_card_network
        CHECK (card_network IS NULL OR card_network IN ('VISA', 'MASTERCARD', 'JCB', 'AMEX', 'NAPAS', 'UNIONPAY', 'OTHER')),
    ADD CONSTRAINT chk_account_card_last4
        CHECK (card_last4 IS NULL OR card_last4 ~ '^[0-9]{4}$'),
    ADD CONSTRAINT chk_account_card_details_type
        CHECK (
            (type IN ('BANK_ACCOUNT', 'CREDIT_CARD') OR (card_network IS NULL AND card_last4 IS NULL))
            AND (type <> 'CASH' OR institution_name IS NULL)
        );

COMMIT;
