<script setup lang="ts">
/** Fiche détaillée d'un signe de la bibliothèque. */
import { computed } from 'vue'
import { categoryName, KIND_LABELS } from '../../core/gardiner'
import { unicodeToMdc } from '../../core/translit'
import { useLibraryStore, type LibrarySign } from '../../stores/library'
import { useUiStore } from '../../stores/ui'

const props = defineProps<{ sign: LibrarySign }>()
const emit = defineEmits<{ (e: 'edit'): void; (e: 'close'): void }>()
const library = useLibraryStore()
const ui = useUiStore()

const mdc = computed(() => props.sign.translit.map(unicodeToMdc))

async function copyGlyph() {
  try {
    await navigator.clipboard.writeText(props.sign.unicode || props.sign.gardiner)
    ui.notify('Caractère copié.')
  } catch {
    ui.notify('Copie impossible dans ce navigateur.', 'error')
  }
}

async function removeOrRevert() {
  const s = props.sign
  const msg =
    s.origin === 'custom'
      ? `Supprimer le signe ${s.gardiner} de votre bibliothèque ?`
      : `Abandonner vos modifications et rétablir le signe ${s.gardiner} d'origine ?`
  if (!confirm(msg)) return
  await library.removeOrRevert(s.gardiner)
  if (s.origin === 'custom') emit('close')
}
</script>

<template>
  <article class="card" :aria-label="`Fiche du signe ${sign.gardiner}`">
    <div class="top">
      <div class="glyph glyph-text" :class="{ missing: !sign.unicode }" aria-hidden="true">
        {{ sign.unicode || sign.gardiner }}
      </div>
      <div class="ident">
        <h3>
          {{ sign.gardiner }}
          <span v-if="sign.verified" class="badge ok" title="Valeurs vérifiées par vous">✓ vérifié</span>
          <span v-else class="badge todo" title="Valeurs à contrôler avec la liste de Gardiner">à vérifier</span>
        </h3>
        <p class="cat">{{ sign.category }} — {{ categoryName(sign.category) }}</p>
        <p v-if="sign.origin !== 'seed'" class="origin">
          {{ sign.origin === 'custom' ? 'Ajouté par vous' : 'Modifié par vous' }}
        </p>
      </div>
      <button class="btn icon close" type="button" aria-label="Fermer la fiche" @click="emit('close')">×</button>
    </div>

    <dl>
      <dt>Valeurs</dt>
      <dd>
        <template v-if="sign.translit.length">
          <span v-for="(t, i) in sign.translit" :key="t" class="translit">
            {{ t }} <span class="mdc" :title="'Écriture MdC (clavier)'">({{ mdc[i] }})</span>
          </span>
        </template>
        <span v-else class="muted">aucune valeur phonétique</span>
      </dd>
      <dt>Type</dt>
      <dd>{{ sign.kind.map((k) => KIND_LABELS[k]).join(', ') }}</dd>
      <dt>Description</dt>
      <dd>{{ sign.descriptionFr || '—' }}</dd>
      <template v-if="sign.notes">
        <dt>Notes</dt>
        <dd class="notes">{{ sign.notes }}</dd>
      </template>
    </dl>

    <div class="actions">
      <button
        class="btn small"
        type="button"
        :aria-pressed="sign.verified"
        @click="library.setVerified(sign.gardiner, !sign.verified)"
      >
        {{ sign.verified ? '✓ Vérifié' : 'Marquer vérifié' }}
      </button>
      <button class="btn small" type="button" @click="emit('edit')">Modifier</button>
      <button class="btn small" type="button" @click="copyGlyph">Copier le caractère</button>
      <button v-if="sign.origin !== 'seed'" class="btn small danger" type="button" @click="removeOrRevert">
        {{ sign.origin === 'custom' ? 'Supprimer' : "Rétablir l'original" }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.card {
  border: 1px solid var(--accent);
  border-radius: 10px;
  padding: 0.7rem;
  background: var(--surface);
  display: grid;
  gap: 0.6rem;
}
.top {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
}
.glyph {
  font-size: 64px;
  line-height: 1;
  min-width: 80px;
  min-height: 80px;
  display: grid;
  place-items: center;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 6px;
}
.glyph.missing {
  font-family: var(--font-ui);
  font-size: 1.1rem;
  color: var(--muted);
}
.ident {
  flex: 1;
  min-width: 0;
}
h3 {
  margin: 0;
  font-size: 1.3rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}
.cat,
.origin {
  margin: 0.15rem 0 0;
  font-size: 0.8rem;
  color: var(--muted);
}
.badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
}
.badge.ok {
  background: #2e7d32;
  color: #fff;
}
.badge.todo {
  background: #f3d9a4;
  color: #5c3b00;
}
.close {
  min-height: 30px;
  min-width: 30px;
  padding: 0;
}
dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.3rem 0.7rem;
  font-size: 0.9rem;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}
.translit {
  font-weight: 600;
  margin-right: 0.6rem;
}
.mdc {
  font-weight: normal;
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.8rem;
}
.notes {
  white-space: pre-wrap;
}
.muted {
  color: var(--muted);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}
</style>
