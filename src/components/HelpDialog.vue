<script setup lang="ts">
import { onMounted, ref } from 'vue'
const emit = defineEmits<{ (e: 'close'): void }>()
const dialog = ref<HTMLDialogElement | null>(null)
onMounted(() => dialog.value?.showModal())
</script>

<template>
  <dialog ref="dialog" class="help panel" aria-labelledby="help-title" @close="emit('close')" @cancel="emit('close')">
    <h2 id="help-title">Aide et raccourcis</h2>
    <h3>Se déplacer dans la photo</h3>
    <ul>
      <li><b>Glisser</b> (souris ou un doigt) : déplacer · <b>molette</b> ou <b>pincer à deux doigts</b> : zoomer</li>
      <li><b>Double-clic</b> : zoomer ici · clic molette glissé : déplacer avec n'importe quel outil</li>
      <li>Visionneuse sélectionnée (Tab) : <kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> déplacer (Maj = plus vite), <kbd>+</kbd>/<kbd>−</kbd> zoomer, <kbd>0</kbd> ajuster, <kbd>1</kbd> taille réelle</li>
    </ul>
    <h3>Outils</h3>
    <ul>
      <li><kbd>P</kbd> correction de perspective · <kbd>F</kbd> filtres · <kbd>L</kbd> loupe</li>
      <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> annuler · <kbd>Ctrl</kbd>+<kbd>Maj</kbd>+<kbd>Z</kbd> ou <kbd>Ctrl</kbd>+<kbd>Y</kbd> rétablir (⌘ sur Mac)</li>
      <li><kbd>Échap</kbd> fermer / quitter l'outil · <kbd>?</kbd> cette aide</li>
    </ul>
    <h3>Lignes de texte</h3>
    <ul>
      <li><kbd>R</kbd> tracer un rectangle (glisser) · <kbd>G</kbd> tracer un polygone (un clic par sommet ; Entrée, double-clic ou clic sur le 1er point pour fermer ; Retour arrière retire le dernier point)</li>
      <li><kbd>V</kbd> outil Sélection : touchez une ligne pour la sélectionner · <kbd>Suppr</kbd> supprimer la ligne sélectionnée</li>
      <li>Ligne sélectionnée : glissez sa pastille <b>✥</b> pour la déplacer, ses carrés jaunes pour la déformer (Tab puis flèches au clavier)</li>
      <li>Les nouvelles lignes reçoivent le sens par défaut choisi dans le panneau ; une forme haute et étroite devient une colonne</li>
    </ul>
    <h3>Bibliothèque de signes</h3>
    <ul>
      <li><kbd>/</kbd> rechercher : code (<code>G17</code>), valeur (<code>m</code>, <code>nfr</code>, MdC <code>Htp</code> = ḥtp), ou mot (<code>chouette</code>)</li>
      <li><kbd>↓</kbd> depuis la recherche pour parcourir les résultats, <kbd>Entrée</kbd> ouvre la fiche, <kbd>Échap</kbd> revient à la recherche</li>
      <li>Les valeurs de départ sont <b>à vérifier</b> avec la liste de Gardiner ; marquez « vérifié » ce que vous avez contrôlé</li>
    </ul>
    <h3>Correction de perspective</h3>
    <p>Placez les 4 poignées sur les coins de la stèle (Tab puis flèches pour les ajuster finement), puis « Appliquer ». L'image est redressée en rectangle. Faites-le <b>avant</b> de tracer les lignes.</p>
    <ul>
      <li>Les poignées peuvent <b>sortir de la photo</b> (coin hors cadre, perspective très forte) : dézoomez pour avoir de la place. Le contour pointillé blanc montre le bord de la photo.</li>
      <li><b>Proportions</b> : « Automatiques » les calcule d'après la forme des 4 coins (en supposant une photo non recadrée). Si vous connaissez les dimensions de la stèle, choisissez « Dimensions réelles » : c'est le plus fiable. Sinon, « Réglage manuel » permet d'élargir ou d'affiner jusqu'à ce que les signes paraissent naturels.</li>
      <li>Rien n'est définitif : appliquez, regardez, revenez ajuster (ou Ctrl+Z).</li>
    </ul>
    <form method="dialog"><button class="btn primary" type="submit" autofocus>Fermer</button></form>
  </dialog>
</template>

<style scoped>
.help {
  max-width: 640px;
  width: calc(100vw - 32px);
  color: var(--text);
}
.help::backdrop {
  background: rgb(0 0 0 / 0.5);
}
h2 {
  margin-top: 0;
}
h3 {
  font-size: 1rem;
  margin: 1rem 0 0.3rem;
}
ul {
  padding-left: 1.2rem;
  margin: 0;
  display: grid;
  gap: 0.25rem;
}
kbd,
code {
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 4px;
  padding: 0 0.3em;
  font-size: 0.85em;
  background: var(--bg);
}
form {
  margin-top: 1rem;
  text-align: right;
}
</style>
