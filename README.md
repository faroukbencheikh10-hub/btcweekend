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
