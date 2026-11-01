<script setup lang="ts">
/** Formulaire d'ajout ou de modification d'un signe. */
import { computed, onMounted, ref } from 'vue'
import { categoryName, categoryOf, KIND_LABELS, normalizeCode, unicodeFor } from '../../core/gardiner'
import { parseTranslitInput } from '../../core/translit'
import { useLibraryStore } from '../../stores/library'
import { useUiStore } from '../../stores/ui'
import type { Sign, SignKind } from '../../types/models'

const props = defineProps<{ initial?: Partial<Sign> }>()
const emit = defineEmits<{ (e: 'saved', code: string): void; (e: 'cancel'): void }>()
const library = useLibraryStore()
const ui = useUiStore()

const isEdit = !!props.initial?.gardiner && !!library.get(props.initial.gardiner)
const code = ref(props.initial?.gardiner ?? '')
const unicode = ref(props.initial?.unicode ?? '')
const translit = ref((props.initial?.translit ?? []).join(', '))
const kinds = ref<SignKind[]>([...(props.initial?.kind ?? [])])
const description = ref(props.initial?.descriptionFr ?? '')
const notes = ref(props.initial?.notes ?? '')
const verified = ref(props.initial?.verified ?? false)
const error = ref('')
const codeInput = ref<HTMLInputElement | null>(null)

const normalized = computed(() => normalizeCode(code.value))
const autoGlyph = computed(() => (normalized.value ? unicodeFor(normalized.value) : ''))
const glyph = computed(() => unicode.value.trim() || autoGlyph.value)
const exists = computed(
  () => !!normalized.value && normalized.value !== props.initial?.gardiner && !!library.get(normalized.value),
)
const parsedTranslit = computed(() =>
  translit.value
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map(parseTranslitInput),
)

onMounted(() => codeInput.value?.focus())

async function submit() {
  error.value = ''
  if (exists.value && !confirm(`Le signe ${normalized.value} existe déjà. Le remplacer ?`)) return
  try {
    const s = await library.save(
      {
        gardiner: code.value,
        unicode: unicode.value,
        translit: parsedTranslit.value,
        kind: kinds.value,
        descriptionFr: description.value,
        notes: notes.value,
        verified: verified.value,
      },
      props.initial?.gardiner,
    )
    ui.notify(`Signe ${s.gardiner} enregistré.`)
    emit('saved', s.gardiner)
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <form class="editor" :aria-label="isEdit ? 'Modifier le signe' : 'Ajouter un signe'" @submit.prevent="submit" @keydown.esc.stop="emit('cancel')">
    <h3>{{ isEdit ? `Modifier ${props.initial?.gardiner}` : 'Ajouter un signe' }}</h3>

    <div class="row">
      <label class="field code">
        <span>Code Gardiner *</span>
        <input ref="codeInput" v-model="code" required autocomplete="off" spellcheck="false" placeholder="G17" />
      </label>
      <div class="preview glyph-text" :class="{ empty: !glyph }" aria-hidden="true">{{ glyph || '?' }}</div>
    </div>
    <p class="hint">
      <template v-if="normalized">
        {{ normalized }} · catégorie {{ categoryOf(normalized) }} ({{ categoryName(categoryOf(normalized)) }})
        <template v-if="!autoGlyph"> · absent d'Unicode : vous pouvez coller un caractère ci-dessous</template>
      </template>
      <template v-else-if="code">Format attendu : lettre(s) + numéro, ex. G17, Aa1, N35A</template>
    </p>
    <p v-if="exists" class="warn">Ce code existe déjà dans la bibliothèque.</p>

    <label class="field">
      <span>Caractère Unicode <small>(rempli automatiquement d'après le code)</small></span>
      <input v-model="unicode" class="glyph-input" :placeholder="autoGlyph" autocomplete="off" />
    </label>

    <label class="field">
      <span>Valeurs de translittération <small>(séparées par des virgules)</small></span>
      <input v-model="translit" autocomplete="off" spellcheck="false" placeholder="ex. nfr  —  ou en MdC : anx, Htp" />
    </label>
    <p v-if="parsedTranslit.length" class="hint">Sera enregistré : <b>{{ parsedTranslit.join(', ') }}</b></p>

    <fieldset class="kinds">
      <legend>Type *</legend>
      <label v-for="(label, k) in KIND_LABELS" :key="k">
        <input v-model="kinds" type="checkbox" :value="k" /> {{ label }}
      </label>
    </fieldset>

    <label class="field">
      <span>Description en français</span>
      <input v-model="description" autocomplete="off" placeholder="ex. chouette" />
    </label>
    <label class="field">
      <span>Notes <small>(sources, emplois…)</small></span>
      <textarea v-model="notes" rows="2" />
    </label>
    <label class="check"><input v-model="verified" type="checkbox" /> Valeurs vérifiées avec la liste de Gardiner</label>

    <p v-if="error" class="warn" role="alert">{{ error }}</p>
    <div class="actions">
      <button class="btn primary" type="submit">Enregistrer</button>
      <button class="btn" type="button" @click="emit('cancel')">Annuler</button>
    </div>
  </form>
</template>

<style scoped>
.editor {
  border: 1px solid var(--accent);
  border-radius: 10px;
  padding: 0.7rem;
  background: var(--surface);
  display: grid;
  gap: 0.5rem;
  font-size: 0.9rem;
}
h3 {
  margin: 0;
  font-size: 1.05rem;
}
.row {
  display: flex;
  gap: 0.6rem;
  align-items: flex-end;
}
.field {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.field.code {
  flex: 1;
}
.field span {
  font-size: 0.82rem;
  color: var(--muted);
}
small {
  font-size: 0.75rem;
}
input:not([type='checkbox']),
textarea {
  font: inherit;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  width: 100%;
}
.glyph-input {
  font-family: var(--font-glyph);
  font-size: 1.5rem;
  line-height: 1.2;
}
.preview {
  font-size: 44px;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
}
.preview.empty {
  color: var(--muted);
  font-family: var(--font-ui);
  font-size: 1.2rem;
}
.hint {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
}
.warn {
  margin: 0;
  color: var(--danger);
  font-size: 0.85rem;
}
.kinds {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.3rem 0.6rem 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem 0.8rem;
}
legend {
  font-size: 0.82rem;
  color: var(--muted);
  padding: 0 0.3rem;
}
.check {
  display: flex;
  gap: 0.4rem;
  align-items: center;
}
.actions {
  display: flex;
  gap: 0.4rem;
}
</style>
