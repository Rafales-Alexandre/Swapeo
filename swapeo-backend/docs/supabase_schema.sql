-- Création des tables pour le projet Swapeo

-- Table des tokens
CREATE TABLE tokens (
  id BIGSERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  reserve_amount TEXT NOT NULL DEFAULT '0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des swaps
CREATE TABLE swaps (
  id BIGSERIAL PRIMARY KEY,
  tx_hash TEXT NOT NULL UNIQUE,
  user_address TEXT NOT NULL,
  input_token TEXT NOT NULL,
  output_token TEXT NOT NULL,
  input_amount TEXT NOT NULL,
  output_amount TEXT NOT NULL,
  fee TEXT NOT NULL DEFAULT '0',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Table des utilisateurs
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  swap_count INTEGER NOT NULL DEFAULT 0,
  total_volume TEXT NOT NULL DEFAULT '0',
  first_interaction TIMESTAMPTZ DEFAULT NOW(),
  last_interaction TIMESTAMPTZ DEFAULT NOW()
);

-- Table des fournisseurs de liquidité
CREATE TABLE liquidity_providers (
  id BIGSERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  token_a_address TEXT NOT NULL,
  token_b_address TEXT NOT NULL,
  total_token_a_liquidity TEXT NOT NULL DEFAULT '0',
  total_token_b_liquidity TEXT NOT NULL DEFAULT '0',
  fees_earned TEXT NOT NULL DEFAULT '0',
  first_deposit TIMESTAMPTZ DEFAULT NOW(),
  last_deposit TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(address, token_a_address, token_b_address)
);

-- Créer des indexes pour améliorer les performances
CREATE INDEX idx_swaps_user_address ON swaps(user_address);
CREATE INDEX idx_swaps_input_token ON swaps(input_token);
CREATE INDEX idx_swaps_output_token ON swaps(output_token);
CREATE INDEX idx_liquidity_providers_address ON liquidity_providers(address);
CREATE INDEX idx_liquidity_providers_token_a ON liquidity_providers(token_a_address);
CREATE INDEX idx_liquidity_providers_token_b ON liquidity_providers(token_b_address);

-- Fonction pour mettre à jour le timestamp automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger pour mettre à jour le timestamp sur les tokens
CREATE TRIGGER update_tokens_updated_at
BEFORE UPDATE ON tokens
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Vues pour faciliter les requêtes courantes

-- Vue pour obtenir les statistiques globales
CREATE VIEW global_stats AS
SELECT
  (SELECT COUNT(*) FROM tokens) AS token_count,
  (SELECT COUNT(*) FROM swaps) AS swap_count,
  (SELECT COUNT(*) FROM users) AS user_count,
  (SELECT COUNT(*) FROM liquidity_providers) AS liquidity_provider_count;

-- Vue pour obtenir les tokens les plus échangés
CREATE VIEW top_tokens AS
SELECT
  t.symbol,
  t.address,
  COUNT(s.id) AS swap_count
FROM
  tokens t
LEFT JOIN
  swaps s ON t.address = s.input_token OR t.address = s.output_token
GROUP BY
  t.symbol, t.address
ORDER BY
  swap_count DESC;

-- Vue pour obtenir les fournisseurs de liquidité les plus actifs
CREATE VIEW top_liquidity_providers AS
SELECT
  lp.address,
  SUM(CAST(lp.total_token_a_liquidity AS NUMERIC) + CAST(lp.total_token_b_liquidity AS NUMERIC)) AS total_liquidity
FROM
  liquidity_providers lp
GROUP BY
  lp.address
ORDER BY
  total_liquidity DESC;

-- Adapter les noms de colonnes pour Supabase
ALTER TABLE tokens RENAME COLUMN reserve_amount TO reserveamount;
ALTER TABLE liquidity_providers RENAME COLUMN token_a_address TO tokenaaddress;
ALTER TABLE liquidity_providers RENAME COLUMN token_b_address TO tokenbaddress;
ALTER TABLE liquidity_providers RENAME COLUMN total_token_a_liquidity TO totaltokenaliquidity;
ALTER TABLE liquidity_providers RENAME COLUMN total_token_b_liquidity TO totaltokenbliquidity;
ALTER TABLE liquidity_providers RENAME COLUMN fees_earned TO feesearned;
ALTER TABLE liquidity_providers RENAME COLUMN first_deposit TO firstdeposit;
ALTER TABLE liquidity_providers RENAME COLUMN last_deposit TO lastdeposit;
ALTER TABLE swaps RENAME COLUMN tx_hash TO txhash;
ALTER TABLE swaps RENAME COLUMN user_address TO useraddress;
ALTER TABLE swaps RENAME COLUMN input_token TO inputtoken;
ALTER TABLE swaps RENAME COLUMN output_token TO outputtoken;
ALTER TABLE swaps RENAME COLUMN input_amount TO inputamount;
ALTER TABLE swaps RENAME COLUMN output_amount TO outputamount;
ALTER TABLE users RENAME COLUMN swap_count TO swapcount;
ALTER TABLE users RENAME COLUMN total_volume TO totalvolume;
ALTER TABLE users RENAME COLUMN first_interaction TO firstinteraction;
ALTER TABLE users RENAME COLUMN last_interaction TO lastinteraction;

-- Mettre à jour les indexes
DROP INDEX IF EXISTS idx_swaps_user_address;
DROP INDEX IF EXISTS idx_swaps_input_token;
DROP INDEX IF EXISTS idx_swaps_output_token;
DROP INDEX IF EXISTS idx_liquidity_providers_address;
DROP INDEX IF EXISTS idx_liquidity_providers_token_a;
DROP INDEX IF EXISTS idx_liquidity_providers_token_b;

CREATE INDEX idx_swaps_useraddress ON swaps(useraddress);
CREATE INDEX idx_swaps_inputtoken ON swaps(inputtoken);
CREATE INDEX idx_swaps_outputtoken ON swaps(outputtoken);
CREATE INDEX idx_liquidity_providers_address ON liquidity_providers(address);
CREATE INDEX idx_liquidity_providers_tokena ON liquidity_providers(tokenaaddress);
CREATE INDEX idx_liquidity_providers_tokenb ON liquidity_providers(tokenbaddress); 