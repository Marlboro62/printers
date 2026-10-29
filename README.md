<p>
  ☕ <strong>Si cette carte vous est utile, vous pouvez soutenir le projet :</strong>
</p>

<div style="white-space: nowrap; line-height: 0;">
  <a
    href="https://www.buymeacoffee.com/Marlboro62"
    target="_blank"
    rel="noopener noreferrer"
    style="display: inline-block; text-decoration: none; vertical-align: middle;"
  ><img
    src="https://img.buymeacoffee.com/button-api/?text=Offrir%20un%20caf%C3%A9&emoji=%E2%98%95&slug=Marlboro62&button_colour=FF5F5F&font_colour=ffffff&font_family=Cookie&outline_colour=000000&coffee_colour=FFDD00"
    alt="Offrir un café sur Buy Me a Coffee"
    height="45"
    style="display: block; border: 0;"
  ></a>&nbsp;&nbsp;<a
    href="https://ko-fi.com/M4M2QL45X"
    target="_blank"
    rel="noopener noreferrer"
    style="display: inline-block; text-decoration: none; vertical-align: middle;"
  ><img
    src="https://storage.ko-fi.com/cdn/kofi6.png?v=6"
    alt="Soutenir le projet sur Ko-fi"
    height="45"
    style="display: block; border: 0;"
  ></a>
</div>

# Cartes Imprimantes 3D et bureau

**Deux cartes Lovelace indépendantes, dans un seul fichier**, pour suivre vos imprimantes dans Home Assistant :

| Type | Carte |
| --- | --- |
| `custom:printers-card` | **Imprimantes 3D** : état, impression en cours, caméra en direct, températures, commandes et statistiques |
| `custom:printers-office-card` | **Imprimantes de bureau** : état et alertes (bourrage, plus de papier…), encre ou toner, pièces d'usure, compteurs de pages |

Elles ont le style des cartes MyElectricalData new ([Carte Enedis Linky New](https://github.com/Marlboro62/content-card-linky-new)) et des [Cartes Serveur HA](https://github.com/Marlboro62/serveur-ha-card) : thème bleu nuit, version claire, ou thème Home Assistant.

**Aucune dépendance** : pas de button-card ni de card-mod. Les imprimantes sont **détectées automatiquement**, une par onglet, et chaque élément sans capteur est simplement masqué.

### Imprimantes 3D

| Impression en cours | En pause | Erreur |
| --- | --- | --- |
| ![Impression en cours](https://raw.githubusercontent.com/Marlboro62/printers/main/images/impression.png) | ![En pause](https://raw.githubusercontent.com/Marlboro62/printers/main/images/pause.png) | ![Erreur](https://raw.githubusercontent.com/Marlboro62/printers/main/images/erreur.png) |

| Impression terminée | Seconde imprimante | Clair |
| --- | --- | --- |
| ![Impression terminée](https://raw.githubusercontent.com/Marlboro62/printers/main/images/terminee.png) | ![Seconde imprimante](https://raw.githubusercontent.com/Marlboro62/printers/main/images/deux-imprimantes.png) | ![Clair](https://raw.githubusercontent.com/Marlboro62/printers/main/images/impression-clair.png) |

### Imprimantes de bureau

| Laser couleur | Encre basse | Bourrage | Clair |
| --- | --- | --- | --- |
| ![Imprimantes de bureau](https://raw.githubusercontent.com/Marlboro62/printers/main/images/bureau.png) | ![Encre basse](https://raw.githubusercontent.com/Marlboro62/printers/main/images/bureau-encre-basse.png) | ![Bourrage](https://raw.githubusercontent.com/Marlboro62/printers/main/images/bureau-bourrage.png) | ![Clair](https://raw.githubusercontent.com/Marlboro62/printers/main/images/bureau-clair.png) |

*Aperçus réalisés avec la démo et des valeurs fictives (imprimantes, fichiers et images de caméra inventés).*

**[▶ Essayer la démo en ligne](https://marlboro62.github.io/printers/docs/demo.html)** : les deux cartes, imprimantes 3D en impression, en pause, terminée, en erreur, prête ou éteinte, imprimantes de bureau normales, avec encre basse, bourrage ou en veille, en sombre ou clair, sur téléphone ou PC.

## Intégrations reconnues

### Imprimantes 3D

| Intégration | Où la trouver | État |
| --- | --- | --- |
| **Moonraker** (Klipper : Voron, Creality K1 / Neo, Elegoo Neptune 4…) | HACS, [home-assistant-moonraker](https://github.com/marcolivierarsenault/moonraker-home-assistant) | testée |
| **OctoPrint** | intégrée à Home Assistant | prévue, non testée |
| **PrusaLink** (MK4, Mini, XL, Core One) | intégrée à Home Assistant | prévue, non testée |
| **Bambu Lab** | HACS, [ha-bambulab](https://github.com/greghesp/ha-bambulab) | prévue, non testée |

### Imprimantes de bureau

| Intégration | Imprimantes | État |
| --- | --- | --- |
| **Internet Printing Protocol (IPP)**, intégrée à Home Assistant | la plupart des imprimantes réseau : HP, Epson, Canon, Brother, Kyocera, imprimantes partagées par CUPS | testée (HP ENVY) |
| **Brother**, intégrée à Home Assistant | Brother laser et jet d'encre (toner, tambour, unité de fixation, courroie, compteurs) | prévue, non testée |
| Intégrations HACS qui donnent les niveaux d'encre en % (Epson Workforce, HP Printer…) | | reconnues d'après le nom des capteurs |

Si votre intégration n'est pas bien reconnue, ouvrez une [issue](https://github.com/Marlboro62/printers/issues) avec la liste des entités de l'imprimante.

## Installation

### Avec HACS (recommandé)

1. Dans HACS, menu **⋮** → **Dépôts personnalisés**.
2. Ajoutez `https://github.com/Marlboro62/printers` avec le type **Tableau de bord** (Dashboard).
3. Cherchez **Cartes Imprimantes 3D et bureau**, installez, puis rechargez la page (Ctrl+F5).

### Manuellement

1. Téléchargez [`printers-card.js`](https://raw.githubusercontent.com/Marlboro62/printers/main/printers-card.js) (clic droit → Enregistrer sous) et copiez-le dans `/config/www/`.
2. **Paramètres → Tableaux de bord → ⋮ → Ressources → Ajouter une ressource** : URL `/local/printers-card.js`, type **Module JavaScript**.
3. Rechargez la page (Ctrl+F5).

## Carte Imprimantes 3D — `custom:printers-card`

```yaml
type: custom:printers-card
```

La carte a un **éditeur visuel**. Sans réglage, elle affiche toutes les imprimantes trouvées.

### Ce qu'elle affiche

- **Onglets** : une imprimante par onglet, avec un point de couleur (prête, en impression, en pause, en erreur) et l'avancement. L'onglet choisi est retenu ; sinon la carte ouvre l'imprimante en cours d'impression.
- **Imprimante déclarée deux fois** (Ethernet et Wi-Fi) : un seul onglet. La carte garde la connexion qui répond, et l'Ethernet si les deux répondent.
- **État** : prête, impression en cours, en pause, terminée, annulée, erreur, hors ligne, avec le message de l'imprimante (erreur Klipper, changement de filament…). La carte prend une bordure rouge en cas d'erreur.
- **Impression** : aperçu du fichier (miniature du trancheur), nom, barre de progression, temps écoulé et restant, heure de fin prévue, couche, filament utilisé, vitesse. Après l'impression : « Dernière impression », avec la durée et l'heure de fin. La carte la garde elle-même (dans le navigateur), même quand l'imprimante efface le fichier à la fin.
- **Caméra** : vidéo en direct (flux de Home Assistant, ouvert une fois et gardé quand la carte se met à jour), ou image par image toutes les 5 s (réglable) pour économiser le réseau.
- **Températures** : buse, plateau et caisson, avec la consigne et la puissance de chauffe, ou « Refroidissement » après l'impression ; températures de l'hôte et de la carte mère, ventilateur.
- **Commandes** : pause, reprise, annulation, arrêt d'urgence, retour à l'origine et lumières. **Annuler, l'arrêt d'urgence et l'origine se confirment en deux clics** : le premier arme le bouton (coche orange qui pulse), le second dans les 5 secondes envoie la commande.
- **Statistiques** : nombre d'impressions, temps total, filament total, plus longue impression.
- **Appareil** : adresse IP de l'imprimante, avec un lien vers sa page d'administration, version du micrologiciel, et mise à jour disponible quand l'intégration en propose une (un clic ouvre la fenêtre d'installation de Home Assistant).
- **Alimentation** : si l'imprimante est branchée sur une prise pilotée (prise connectée, module MQTT…), bouton **Allumer**, et **Éteindre** en deux clics (jamais pendant une impression). La prise est trouvée d'après le nom de l'imprimante (`switch.prise_neptune` pour « Neptune 4 Max »), ou indiquée avec `power`. Prise coupée : l'imprimante s'affiche **« Éteinte »** ; prise allumée, le temps que l'intégration revienne : **« Démarrage… »**.
- **Intégration désactivée à l'extinction** (par exemple par une automatisation qui coupe Moonraker quand la prise s'éteint) : l'imprimante reste affichée grâce à son appareil, même sans entités.

Un clic sur un élément ouvre la fiche de l'entité dans Home Assistant.

### Options

| Option | Rôle | Par défaut |
| --- | --- | --- |
| `title` | Titre de la carte | nom de l'imprimante, ou « Imprimantes 3D » |
| `icon`, `icon_color` | Icône et couleur de l'icône | `mdi:printer-3d`, bleu |
| `printers` | Imprimantes affichées, dans cet ordre : appareils, ou `{ device, name, camera, power }` | toutes |
| `power` | `false` : ne pas chercher de prise d'alimentation (sinon, par imprimante dans `printers`) | prise trouvée d'après le nom |
| `camera` | Caméra à afficher, à la place de celle de l'imprimante | caméra de l'imprimante |
| `camera_mode` | `live` (vidéo en direct) ou `snapshot` (image par image) | `live` |
| `camera_refresh` | Rafraîchissement en mode `snapshot` (secondes, 2 au minimum) | `5` |
| `show_job`, `show_camera`, `show_temps`, `show_controls`, `show_stats`, `show_device` | Afficher chaque partie | `true` |
| `theme` | `v2` (bleu nuit MyElectricalData), `auto` (clair ou sombre selon Home Assistant) ou `ha` (thème Home Assistant) | `v2` |

Exemple avec deux imprimantes, un nom et une caméra choisis :

```yaml
type: custom:printers-card
printers:
  - device: 0123456789abcdef0123456789abcdef
    name: Atelier
    camera: camera.atelier_webcam
    power: switch.prise_atelier
  - 89abcdef0123456789abcdef01234567
```

L'éditeur visuel remplit `printers` pour vous : choisissez les appareils dans la liste.

## Carte Imprimantes de bureau — `custom:printers-office-card`

```yaml
type: custom:printers-office-card
```

La carte a un **éditeur visuel**. Sans réglage, elle affiche toutes les imprimantes trouvées par les intégrations IPP et Brother.

### Ce qu'elle affiche

- **Onglets** : une imprimante par onglet, avec un point de couleur (prête, en impression, à surveiller, en erreur). Sans onglet retenu, la carte ouvre l'imprimante qui demande votre attention.
- **État** : prête, en veille, impression en cours, arrêtée, erreur, hors ligne, avec la raison en clair : **plus de papier, bourrage papier, capot ouvert, consommable vide ou bas**. La carte prend une bordure rouge en cas d'erreur.
- **Encre ou toner** : une jauge par cartouche, à sa couleur (noir, cyan, magenta, jaune, couleur, noir photo…), avec « Bas » ou « À remplacer » sous le seuil d'alerte (15 % par défaut, ou le seuil donné par l'imprimante).
- **Pièces d'usure** (Brother) : tambour, unité de fixation, courroie, laser, kit papier, avec leur durée de vie restante.
- **Compteurs** : pages imprimées, noir et blanc, couleur, recto verso, et durée depuis le dernier démarrage.
- **Appareil** : adresse IP de l'imprimante, avec un lien vers sa page d'administration, version du micrologiciel, et mise à jour disponible quand l'intégration en propose une (un clic ouvre la fenêtre d'installation de Home Assistant).
- **Alimentation** : si l'imprimante est branchée sur une prise pilotée (prise connectée, module MQTT…), bouton **Allumer**, et **Éteindre** en deux clics (jamais pendant une impression). La prise est trouvée d'après le nom de l'imprimante (`switch.prise_neptune` pour « Neptune 4 Max »), ou indiquée avec `power`. Prise coupée : l'imprimante s'affiche **« Éteinte »** ; prise allumée, le temps que l'intégration revienne : **« Démarrage… »**.
- **Intégration désactivée à l'extinction** (par exemple par une automatisation qui coupe Moonraker quand la prise s'éteint) : l'imprimante reste affichée grâce à son appareil, même sans entités.

Un clic sur un élément ouvre la fiche de l'entité dans Home Assistant.

### Options

| Option | Rôle | Par défaut |
| --- | --- | --- |
| `title` | Titre de la carte | nom de l'imprimante, ou « Imprimantes » |
| `icon`, `icon_color` | Icône et couleur de l'icône | `mdi:printer`, bleu |
| `printers` | Imprimantes affichées, dans cet ordre : appareils, ou `{ device, name }` | toutes |
| `low_level` | Seuil d'alerte de l'encre et du toner (%) | `15` |
| `show_supplies`, `show_parts`, `show_counters`, `show_device` | Afficher chaque partie | `true` |
| `theme` | `v2`, `auto` ou `ha` | `v2` |

## Support

Questions et problèmes : uniquement via les [issues GitHub](https://github.com/Marlboro62/printers/issues).

## Voir aussi

[Cartes Serveur HA](https://github.com/Marlboro62/serveur-ha-card) · [Carte Onduleur UPS](https://github.com/Marlboro62/onduleur-ups-card) · [Carte Enedis Linky New](https://github.com/Marlboro62/content-card-linky-new)

## Licence

MIT
