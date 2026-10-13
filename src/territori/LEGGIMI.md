# Cartine dei territori

Metti qui i PDF delle cartine, con questo schema di nome:

    territorio_<numero>_<nome>.pdf

- **Numero**: può avere una lettera finale (`35A`, `35B`). Gli zeri iniziali si ignorano: `01` è il territorio 1.
- **Nome**: le parole si separano con `_`, che nell'app diventa uno spazio (`Sticciano_Scalo` → "Sticciano Scalo").
- **Sezione**, ricavata dal nome:
  - se il nome inizia con `Commerciale` → sezione Commerciale (`territorio_59_Commerciale_Ribolla_1.pdf`);
  - se il nome contiene `Rurale` → sezione Rurale (`territorio_83_Pereti_Rurale_2.pdf`);
  - altrimenti la sezione è il paese, senza un eventuale numero finale (`territorio_12_Ribolla.pdf` → Ribolla).

I colori delle sezioni seguono l'ordine dei numeri: un paese nuovo con numeri più alti degli altri non cambia i colori esistenti, uno inserito in mezzo li fa slittare.
Ogni file aggiunto o sostituito compare nell'app dopo un nuovo deploy (in locale basta ricaricare `npm run dev`).
