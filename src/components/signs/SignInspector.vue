<script setup lang="ts">
/**
 * Panneau « Signe » : réglages des boîtes sélectionnées.
 *  - une boîte : identification, statut, note, ordre, carré, cartouche, comparaison ;
 *  - plusieurs boîtes : statut commun, grouper en carré, cartouche, suppression.
 */
import { computed } from 'vue'
import { useProjectStore } from '../../stores/project'
import { useUiStore } from '../../stores/ui'
import { useLibraryStore } from '../../stores/library'
import { useSelection } from '../../composables/useSelection'
import { STATUS_HELP, STATUS_LABELS, useSignActions } from '../../composables/useSignActions'
import { cartoucheOf } from '../../core/items'
import { layoutQuadrat, layoutToText } from '../../core/quadratLayout'
import { KIND_LABELS } from '../../core/gardiner'
import type { SignStatus } from '../../types/models'
import CompareView from './CompareView.vue'

const store = useProjectStore()
const ui = useUiStore()
const library = useLibraryStore()
const { selected, single } = useSelection()
const actions = useSignActions()

const STATUSES: SignStatus[] = ['certain', 'probable', 'incertain', 'lacune']
const ids = computed(() => selected.value.map((s) => s.item.id))
const sign = computed(() => (single.value?.item.signCode ? library.get(single.value.item.signCode) : undefined))

/** Statut commun aux boîtes sélectionnées (ou null s'ils diffèrent). */
const commonStatus = computed(() => {
  const st = new Set(selected.value.map((s) => s.item.status))
  return st.size === 1 ? [...st][0] : null
})
const sameLine = computed(() => new Set(selected.value.map((s) => s.line.id)).size === 1)

const quadrat = computed(() => {
  const gid = single.value?.item.groupId
  return gid ? store.project?.groups.find((g) => g.id === gid) ?? null : null
})
const quadratText = computed(() => {
  const q = quadrat.value
  const s = single.value
  if (!q || !s) return ''
  const members = s.line.items.filter((i) => q.memberIds.includes(i.id))
  const tree = layoutQuadrat(members.map((m) => ({ id: m.id, box: m.bbox })), s.line.direction)
  return layoutToText(tree, (id) => members.find((m) => m.id === id)?.signCode ?? '?')
})
const cartouche = computed(() => (single.value && store.project ? cartoucheOf(store.project, single.value.item.id) : undefined))

function onNote(e: Event) {
  if (single.value) actions.setNote(single.value.item.id, (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <section class="inspector" aria-labelledby="insp-title">
    <div class="head">
      <h2 id="insp-title">
        <template v-if="single">
          Signe {{ single.index + 1 }}/{{ single.line.items.length }}
          <span class="muted">· {{ single.line.orientation === 'column' ? 'C' : 'L' }}{{ single.line.number }}</span>
        </template>
        <template v-else>{{ selected.length }} signes sélectionnés</template>
      </h2>
      <div class="nav">
        <button class="btn icon small" type="button" aria-label="Signe précédent (Page préc.)" title="Signe précédent (Page préc.)" @click="actions.go(-1)">‹</button>
        <button class="btn icon small" type="button" aria-label="Signe suivant (Page suiv.)" title="Signe suivant (Page suiv.)" @click="actions.go(1)">›</button>
        <button class="btn icon small" type="button" aria-label="Désélectionner (Échap)" title="Désélectionner (Échap)" @click="ui.selectedItemIds = []">×</button>
      </div>
    </div>

    <!-- Identification (une seule boîte) -->
    <div v-if="single" class="ident">
      <CompareView
        :bbox="single.item.bbox"
        :glyph="sign?.unicode"
        :code="single.item.signCode"
        :mirror="single.line.direction === 'rtl'"
        :size="84"
      />
      <div class="ident-text">
        <p v-if="single.item.signCode" class="code">
          {{ single.item.signCode }}
          <span v-if="sign" class="tr">{{ sign.translit.join(', ') }}</span>
        </p>
        <p v-else class="muted">{{ single.item.status === 'lacune' ? 'Lacune (signe détruit)' : 'Signe non identifié' }}</p>
        <p v-if="sign" class="small muted">{{ sign.kind.map((k) => KIND_LABELS[k]).join(', ') }} — {{ sign.descriptionFr }}</p>
        <p v-else-if="single.item.signCode" class="small warn">Code absent de la bibliothèque.</p>
        <button class="btn small" type="button" @click="ui.quickEntryFocus++">
          {{ single.item.signCode ? 'Changer (Entrée)' : 'Identifier (Entrée)' }}
        </button>
        <p v-if="single.line.direction === 'rtl'" class="small muted">Glyphe retourné : la ligne se lit de droite à gauche.</p>
      </div>
    </div>

    <!-- Statut -->
    <div class="field">
      <span id="status-label">Statut</span>
      <div class="seg" role="radiogroup" aria-labelledby="status-label">
        <button
          v-for="st in STATUSES"
          :key="st"
          type="button"
          role="radio"
          :class="st"
          :aria-checked="commonStatus === st"
          :title="STATUS_HELP[st]"
          @click="actions.setStatus(ids, st)"
        >
          {{ STATUS_LABELS[st] }}
        </button>
      </div>
    </div>

    <label v-if="single" class="field">
      <span>Note</span>
      <textarea :value="single.item.note" rows="2" placeholder="ex. trace d'un trait horizontal en haut" @input="onNote" />
    </label>

    <!-- Ordre de lecture -->
    <div v-if="single" class="field">
      <span>Ordre de lecture</span>
      <div class="row">
        <button class="btn small" type="button" @click="actions.moveInOrder(single.item.id, -1)">◂ Plus tôt</button>
        <button class="btn small" type="button" @click="actions.moveInOrder(single.item.id, 1)">Plus tard ▸</button>
      </div>
      <p v-if="single.line.manualOrder" class="small">
        Ordre corrigé à la main.
        <button class="link" type="button" @click="actions.autoOrder(single.line.id)">Revenir à l'ordre automatique</button>
      </p>
    </div>

    <!-- Carré et cartouche -->
    <div class="field">
      <span>Groupes</span>
      <div class="row">
        <button v-if="quadrat" class="btn small" type="button" @click="actions.ungroup(quadrat.id)">Défaire le carré</button>
        <button
          v-else
          class="btn small"
          type="button"
          :disabled="selected.length < 2 || !sameLine"
          title="Grouper en carré (Q) — sélectionnez plusieurs signes avec Maj + clic"
          @click="actions.groupQuadrat(ids)"
        >
          Grouper en carré (Q)
        </button>
        <button v-if="cartouche" class="btn small" type="button" @click="actions.removeGroup(cartouche.id)">Retirer le cartouche</button>
        <button
          v-else
          class="btn small"
          type="button"
          :disabled="!sameLine"
          title="Cartouche (K) — du premier au dernier signe sélectionné"
          @click="actions.makeCartouche(ids)"
        >
          Cartouche (K)
        </button>
      </div>
      <p v-if="quadratText" class="small">Disposition du carré : <code>{{ quadratText }}</code> <span class="muted">(« : » empilés, « * » côte à côte)</span></p>
      <button class="btn small" type="button" :aria-pressed="ui.multiSelect" @click="ui.multiSelect = !ui.multiSelect">
        {{ ui.multiSelect ? '✓ Sélection multiple (touchez les boîtes)' : 'Sélection multiple' }}
      </button>
      <p v-if="selected.length === 1 && !quadrat && !ui.multiSelect" class="small muted">
        Pour un carré ou un cartouche : Maj + clic sur d'autres boîtes, ou « Sélection multiple » sur tablette.
      </p>
      <p v-if="!sameLine" class="small warn">Les signes choisis sont sur des lignes différentes.</p>
    </div>

    <div class="row">
      <button class="btn small danger" type="button" @click="actions.deleteItems(ids)">
        Supprimer {{ selected.length > 1 ? `les ${selected.length} boîtes` : 'la boîte' }} (Suppr)
      </button>
    </div>
  </section>
</template>

<style scoped>
.inspector {
  display: grid;
  gap: 0.6rem;
  font-size: 0.9rem;
  padding-bottom: 0.8rem;
  border-bottom: 2px solid var(--border);
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.4rem;
}
h2 {
  margin: 0;
  font-size: 1rem;
}
.nav {
  display: flex;
  gap: 0.2rem;
}
.nav .btn {
  min-height: 30px;
  min-width: 30px;
  padding: 0;
  font-size: 1.1rem;
}
.muted {
  color: var(--muted);
  font-weight: normal;
}
.warn {
  color: var(--danger);
}
.small {
  font-size: 0.78rem;
  margin: 0;
}
.ident {
  display: grid;
  gap: 0.4rem;
}
.ident-text {
  display: grid;
  gap: 0.25rem;
  justify-items: start;
}
.ident-text p {
  margin: 0;
}
.code {
  font-weight: 700;
  font-size: 1.05rem;
}
.tr {
  color: var(--accent);
  margin-left: 0.4rem;
}
.field {
  display: grid;
  gap: 0.25rem;
}
.field > span {
  font-size: 0.8rem;
  color: var(--muted);
}
.seg {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.seg button {
  font: inherit;
  font-size: 0.78rem;
  border: none;
  background: var(--surface);
  color: var(--text);
  padding: 0.4rem 0.2rem;
  cursor: pointer;
  min-height: 34px;
  border-left: 4px solid transparent;
}
.seg button + button {
  box-shadow: -1px 0 0 var(--border);
}
.seg .certain {
  border-left-color: #34c759;
}
.seg .probable {
  border-left-color: #4aa8ff;
}
.seg .incertain {
  border-left-color: #ff9f0a;
}
.seg .lacune {
  border-left-color: #ff453a;
}
.seg button[aria-checked='true'] {
  background: var(--accent);
  color: var(--accent-text);
}
textarea {
  font: inherit;
  padding: 0.35rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  resize: vertical;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
.link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--accent);
  text-decoration: underline;
  cursor: pointer;
}
code {
  font-family: var(--font-mono);
  background: var(--hover);
  padding: 0 0.25em;
  border-radius: 3px;
}
</style>
