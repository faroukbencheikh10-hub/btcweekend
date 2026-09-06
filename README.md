# ETH Weekend

Copia di Soldi ORB portata su **ETHUSD**, pensata per girare nel weekend
quando l'oro e' chiuso e "soldi" dorme.

Strategia: **ORB M5**. Niente ICT, niente AI, niente filtri orari.

- Box = ultime 8-16 M5 prima della candela attuale.
- Entry = chiusura M5 fuori dal box.
- Stop = lato opposto del box.
- TP1 = 1.6R, TP2 = 2.4R (con minimi/massimi).
- Niente inseguimento oltre il bordo, niente candela shock.

Le soglie in dollari dell'oro (box 5-18$, inseguimento 8$, shock 20$, TP1 12$, TP2 20-30$)
sono espresse in **percentuale del prezzo** e ricalcolate ad ogni ciclo, cosi' la logica
e' la stessa qualunque sia il prezzo di ETH.

`SOLO_WEEKEND=true` limita l'analisi alla finestra venerdi 21:00 UTC -> domenica 22:00 UTC.

Il simbolo e' letto da `METAAPI_SYMBOL` (default `ETHUSD`).
Il database usa le stesse tabelle di Soldi: la colonna `xauusd` contiene il prezzo del simbolo configurato.

### Chiusura trade

Ad ogni `/api/cron/analyze` (all'inizio, anche se non nasce un nuovo segnale) gli aperti
vengono chiusi scorrendo le candele M5 da `attivato_il`/`created_at`, non sul prezzo corrente.
Stessa candela SL+TP → LOSS. `closed_at` = datetime della candela che ha chiuso.

`SPREAD_BUFFER_PCT` (default `0.05`, cioè 0.05% del prezzo) allarga solo lo SL:
BUY chiude in LOSS se `low <= SL + buffer`, SELL se `high >= SL - buffer`. I TP restano invariati.
Se le candele MetaApi sono Bid, il buffer simula l'Ask sui SELL e uno stop più facile sui BUY.
