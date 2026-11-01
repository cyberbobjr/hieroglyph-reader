<script setup lang="ts">
/** Écran d'accueil : la liste des stèles enregistrées sur cet appareil. */
import { onMounted, ref } from 'vue'
import { useProjectsStore } from '../../stores/projects'
import { useUiStore } from '../../stores/ui'

const emit = defineEmits<{ (e: 'open', id: string): void }>()
const projects = useProjectsStore()
const ui = useUiStore()
const imageInput = ref<HTMLInputElement | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const creating = ref(false)
const dragOver = ref(false)

onMounted(() => void projects.refresh())

async function createFrom(file: File | undefined) {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ui.notify('Ce fichier n’est pas une image.', 'error')
    return
  }
  creating.value = true
  try {
    emit('open', await projects.createFromImage(file))
  } catch (e) {
    ui.notify(`Impossible de lire cette image : ${(e as Error).message}`, 'error', 6000)
  } finally {
    creating.value = false
  }
}

async function onImport(file: File | undefined) {
  if (!file) return
  try {
    const id = await projects.importFile(file)
    ui.notify('Projet importé.')
    emit('open', id)
  } catch (e) {
    ui.notify((e as Error).message, 'error', 6000)
  }
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const file = e.dataTransfer?.files[0]
  if (!file) return
  if (file.name.endsWith('.json')) void onImport(file)
  else void createFrom(file)
}

async function rename(id: string, current: string) {
  const name = prompt('Nouveau nom de la stèle :', current)
  if (name !== null) await projects.rename(id, name)
}

async function remove(id: string, name: string) {
  if (confirm(`Supprimer définitivement « ${name} » de cet appareil ?\nPensez à l’exporter avant si vous voulez la garder.`)) {
    await projects.remove(id)
    ui.notify('Stèle supprimée.')
  }
}

const fmt = (t: number) =>
  new Date(t).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <main class="home" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop">
    <header class="hero">
      <h1><span class="glyph" aria-hidden="true">𓂀</span> Hieroglyph Reader</h1>
      <p>Transcrivez une stèle signe par signe, à partir d'une photo. Tout reste sur votre appareil.</p>
    </header>

    <div class="actions">
      <button class="btn primary big" type="button" :disabled="creating" @click="imageInput?.click()">
        {{ creating ? 'Chargement…' : '+ Nouvelle stèle depuis une photo' }}
      </button>
      <button class="btn big" type="button" @click="importInput?.click()">Importer un projet (.json)</button>
      <input ref="imageInput" type="file" accept="image/*" hidden @change="createFrom(($event.target as HTMLInputElement).files?.[0]); ($event.target as HTMLInputElement).value = ''" />
      <input ref="importInput" type="file" accept=".json,application/json" hidden @change="onImport(($event.target as HTMLInputElement).files?.[0]); ($event.target as HTMLInputElement).value = ''" />
    </div>
    <p class="drop-hint" :class="{ active: dragOver }">…ou déposez une photo ou un fichier projet ici.</p>

    <section aria-labelledby="list-title">
      <h2 id="list-title">Mes stèles <span class="count">({{ projects.list.length }})</span></h2>
      <p v-if="!projects.loading && projects.list.length === 0" class="empty">
        Aucune stèle pour l'instant. Commencez par charger une photo.
      </p>
      <ul class="grid">
        <li v-for="p in projects.list" :key="p.id" class="card">
          <button class="thumb" type="button" :aria-label="`Ouvrir ${p.name}`" @click="emit('open', p.id)">
            <img v-if="p.thumbnail" :src="p.thumbnail" alt="" />
            <span v-else class="noimg" aria-hidden="true">𓉐</span>
          </button>
          <div class="info">
            <h3><button class="link" type="button" @click="emit('open', p.id)">{{ p.name }}</button></h3>
            <p class="meta">{{ p.lineCount }} ligne(s) · {{ p.signCount }} signe(s)</p>
            <p class="meta">Modifiée le {{ fmt(p.updatedAt) }}</p>
            <div class="row">
              <button class="btn small" type="button" @click="rename(p.id, p.name)">Renommer</button>
              <button class="btn small" type="button" @click="projects.duplicate(p.id)">Dupliquer</button>
              <button class="btn small" type="button" @click="projects.exportToFile(p.id)">Exporter</button>
              <button class="btn small danger" type="button" @click="remove(p.id, p.name)">Supprimer</button>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <footer class="foot">
      Les données sont enregistrées dans ce navigateur uniquement. Effacer les données du site les supprime :
      exportez régulièrement vos projets.
    </footer>
  </main>
</template>

<style scoped>
.home {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1rem 3rem;
  min-height: 100%;
}
.hero h1 {
  margin: 0 0 0.3rem;
  font-size: clamp(1.6rem, 4vw, 2.3rem);
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.glyph {
  font-family: var(--font-glyph);
  color: var(--accent);
  font-size: 1.3em;
}
.hero p {
  color: var(--muted);
  margin: 0 0 1.5rem;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.drop-hint {
  color: var(--muted);
  font-size: 0.9rem;
  border: 2px dashed transparent;
  padding: 0.4rem;
  border-radius: 8px;
}
.drop-hint.active {
  border-color: var(--accent);
  color: var(--text);
}
h2 {
  margin-top: 2rem;
  font-size: 1.2rem;
}
.count {
  color: var(--muted);
  font-weight: normal;
}
.empty {
  color: var(--muted);
}
.grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}
.card {
  display: flex;
  gap: 0.8rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 0.75rem;
  box-shadow: var(--shadow);
}
.thumb {
  flex: 0 0 96px;
  height: 96px;
  border: none;
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--viewer-bg);
  cursor: pointer;
  display: grid;
  place-items: center;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.noimg {
  font-family: var(--font-glyph);
  font-size: 2.5rem;
  color: #aaa;
}
.info {
  min-width: 0;
  flex: 1;
}
.info h3 {
  margin: 0 0 0.2rem;
  font-size: 1.05rem;
}
.link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  overflow-wrap: anywhere;
}
.link:hover {
  text-decoration: underline;
}
.meta {
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted);
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.5rem;
}
.foot {
  margin-top: 3rem;
  color: var(--muted);
  font-size: 0.82rem;
}
</style>
