# CoudeProgres

CoudeProgres est une première application mobile de suivi personnel de rééducation du coude. Elle permet de noter :

- les rendez-vous médicaux et séances de kinésithérapie ;
- les exercices d'autorééducation ;
- les ressentis, mesures facultatives et petites réussites ;
- les prochaines étapes indiquées par un professionnel de santé.

## V1

L'application fonctionne comme une application web installable (`PWA`) et hors ligne. Les données sont conservées uniquement dans le navigateur de l'appareil. Chaque utilisateur possède son propre carnet chiffré par sa phrase secrète ; changer d'utilisateur ne remplace pas les données d'un autre.

Elle distingue désormais deux moments :

- **Planifier** un futur rendez-vous médical ou de kinésithérapie avec la date et l'heure ;
- **Faire le bilan** après la séance pour noter durée, douleur, ressenti, mobilité et progrès notable.

L'accueil rappelle les rendez-vous passés dont le bilan reste à compléter. Il présente aussi les progrès issus des bilans, sans confondre un rendez-vous simplement prévu avec une séance réellement effectuée. L'application comprend également un calendrier mensuel, un historique filtrable par sujet, statut et mois, une sauvegarde chiffrée téléchargeable même depuis l'écran verrouillé, un export CSV et un export calendrier.

Les exports CSV et calendrier ne sont pas chiffrés. La sauvegarde `.json`, elle, reste chiffrée.

Cette V1 n'envoie pas les notes à une intelligence artificielle. Les messages d'encouragement sont calculés localement à partir des entrées. Une future fonction d'IA pourra rester optionnelle et préciser les données volontairement transmises.

Ne jamais déposer dans GitHub un fichier exporté par l'application (`coudeprogres-sauvegarde-*.json`, `coudeprogres-liste-*.csv` ou `coudeprogres-rendez-vous-*.ics`). Le projet les exclut automatiquement lorsqu'ils portent ces noms.

## Essayer l'application

Prérequis : Python 3 ou tout serveur web statique local.

```bash
npm start
```

Puis ouvrir `http://localhost:4173`.

## Utilisation sur iPhone

Pour l'installer sur un iPhone, les fichiers doivent être publiés sur une adresse HTTPS privée ou maîtrisée. Ouvrir ensuite cette adresse dans Safari, toucher **Partager**, puis **Sur l'écran d'accueil**.

Une fois installée, l'application fonctionne hors ligne. Les données saisies sur l'iPhone restent sur l'iPhone : elles ne se synchronisent pas automatiquement avec un ordinateur ou un autre téléphone. La sauvegarde chiffrée permet de les transférer volontairement. Lors de l'import, elle est ajoutée dans un nouvel utilisateur et ne remplace pas un carnet déjà présent.

Si l'ouverture échoue sur l'iPhone, télécharger d'abord la sauvegarde chiffrée depuis l'écran verrouillé : cette opération conserve le carnet local et fournit une copie de secours avant toute investigation.

## Protection et limites

- Le chiffrement utilise `AES-GCM` avec une clé dérivée de la phrase secrète par `PBKDF2-SHA-256`.
- La phrase secrète n'est pas stockée. Sans elle, il n'est pas possible de relire une sauvegarde ou le carnet local.
- Les espaces placés involontairement avant ou après une nouvelle phrase secrète sont ignorés.
- En cas de perte de la phrase secrète, l'écran de déverrouillage permet de supprimer uniquement le carnet de l'utilisateur concerné.
- Après plus de cinq minutes en arrière-plan, l'application demande de nouveau la phrase secrète.
- Vider les données Safari ou supprimer le stockage du site efface le carnet local : effectuer régulièrement une sauvegarde chiffrée.
- CoudeProgres est un carnet de suivi et de motivation, pas un outil médical. Les exercices et décisions de soin restent ceux convenus avec le médecin ou le kinésithérapeute.

## Suite envisagée

Les remboursements, arrêts ou temps partiel thérapeutique et documents administratifs sont volontairement réservés à une V2, afin de lancer rapidement une V1 simple et fiable.
