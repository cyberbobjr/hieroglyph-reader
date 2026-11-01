<script setup lang="ts">
/**
 * Point d'entrée de l'interface. L'adresse (#/stele/<id>) indique la stèle
 * ouverte : un rechargement de page la rouvre directement.
 */
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useProjectStore } from './stores/project'
import { useUiStore } from './stores/ui'
import HomeScreen from './components/home/HomeScreen.vue'
import Workspace from './components/Workspace.vue'
import HelpDialog from './components/HelpDialog.vue'

const store = useProjectStore()
const ui = useUiStore()
const opening = ref(false)

function idFromHash(): string | null {
  const m = location.hash.match(/^#\/stele\/([\w-]+)/)
  return m ? m[1] : null
}

async function syncWithHash() {
  const id = idFromHash()
  if (id && store.project?.id !== id) {
    opening.value = true
    const ok = await store.open(id)
    opening.value = false
    if (!ok) {
      ui.notify('Cette stèle est introuvable sur cet appareil.', 'error')
      location.hash = ''
    }
  } else if (!id && store.isOpen) {
    await store.close()
  }
}

const openProject = (id: string) => (location.hash = `#/stele/${id}`)
const closeProject = () => (location.hash = '')

// Avant de fermer l'onglet, on enregistre ce qui est en attente.
const beforeUnload = () => void store.flush()
onMounted(() => {
  window.addEventListener('hashchange', syncWithHash)
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('visibilitychange', beforeUnload)
  void syncWithHash()
})
onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncWithHash)
  window.removeEventListener('beforeunload', beforeUnload)
  document.removeEventListener('visibilitychange', beforeUnload)
})
</script>

<template>
  <Workspace v-if="store.isOpen" @close="closeProject" />
  <p v-else-if="opening" class="loading">Ouverture…</p>
  <HomeScreen v-else @open="openProject" />

  <HelpDialog v-if="ui.helpOpen" @close="ui.helpOpen = false" />

  <div class="toasts" aria-live="polite">
    <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.kind" :role="t.kind === 'error' ? 'alert' : 'status'">
      {{ t.text }}
    </div>
  </div>
</template>

<style scoped>
.loading {
  padding: 2rem;
  text-align: center;
  color: var(--muted);
}
.toasts {
  position: fixed;
  bottom: 72px;
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  gap: 0.4rem;
  z-index: 100;
  pointer-events: none;
}
.toast {
  background: var(--text);
  color: var(--bg);
  padding: 0.5rem 1rem;
  border-radius: 8px;
  box-shadow: var(--shadow);
  font-size: 0.9rem;
}
.toast.error {
  background: var(--danger);
  color: #fff;
}
</style>
