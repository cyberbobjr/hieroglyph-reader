<script setup lang="ts">
/**
 * Réglages d'affichage. Ils changent seulement la façon de VOIR la photo :
 * l'image enregistrée reste intacte.
 */
import { computed } from 'vue'
import { useProjectStore } from '../../stores/project'
import { DEFAULT_FILTERS, type ImageFilters } from '../../types/models'

const store = useProjectStore()
const f = computed(() => store.project!.filters)

function set<K extends keyof ImageFilters>(key: K, value: ImageFilters[K], label: string) {
  store.mutate(`Filtre : ${label}`, (p) => {
    p.filters[key] = value
  }, `filter-${key}`)
}

function reset() {
  store.mutate('Réinitialiser les filtres', (p) => {
    p.filters = { ...DEFAULT_FILTERS }
  })
}
</script>

<template>
  <section class="filters panel" aria-label="Filtres d'affichage">
    <header>
      <h2>Filtres</h2>
      <button class="btn small" type="button" @click="reset">Réinitialiser</button>
    </header>
    <p class="hint">L'original n'est jamais modifié.</p>

    <label class="check">
      <input type="checkbox" :checked="f.grayscale" @change="set('grayscale', ($event.target as HTMLInputElement).checked, 'niveaux de gris')" />
      Niveaux de gris
    </label>
    <label class="check">
      <input type="checkbox" :checked="f.autoContrast" @change="set('autoContrast', ($event.target as HTMLInputElement).checked, 'contraste automatique')" />
      Contraste automatique
    </label>
    <label class="check">
      <input type="checkbox" :checked="f.invert" @change="set('invert', ($event.target as HTMLInputElement).checked, 'inversion')" />
      Inverser (négatif)
    </label>

    <label class="range">
      <span>Luminosité <output>{{ f.brightness }} %</output></span>
      <input type="range" min="30" max="250" step="5" :value="f.brightness" @input="set('brightness', +($event.target as HTMLInputElement).value, 'luminosité')" />
    </label>
    <label class="range">
      <span>Contraste <output>{{ f.contrast }} %</output></span>
      <input type="range" min="30" max="300" step="5" :value="f.contrast" @input="set('contrast', +($event.target as HTMLInputElement).value, 'contraste')" />
    </label>

    <fieldset>
      <legend>Accentuation du relief</legend>
      <label class="range">
        <span>Intensité <output>{{ f.relief.toFixed(1) }}</output></span>
        <input type="range" min="0" max="6" step="0.5" :value="f.relief" @input="set('relief', +($event.target as HTMLInputElement).value, 'relief')" />
      </label>
      <div class="radios" role="radiogroup" aria-label="Méthode">
        <label><input type="radio" name="relief-mode" :checked="f.reliefMode === 'unsharp'" @change="set('reliefMode', 'unsharp', 'méthode de relief')" /> Netteté (garde les couleurs)</label>
        <label><input type="radio" name="relief-mode" :checked="f.reliefMode === 'emboss'" @change="set('reliefMode', 'emboss', 'méthode de relief')" /> Lumière rasante</label>
      </div>
    </fieldset>
  </section>
</template>

<style scoped>
.filters {
  width: min(300px, calc(100vw - 32px));
  display: grid;
  gap: 0.6rem;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
h2 {
  font-size: 1rem;
  margin: 0;
}
.hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
}
.check {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.range {
  display: grid;
  gap: 0.2rem;
}
.range span {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}
output {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
fieldset {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.7rem;
  display: grid;
  gap: 0.4rem;
}
legend {
  font-size: 0.9rem;
  padding: 0 0.3rem;
}
.radios {
  display: grid;
  gap: 0.2rem;
  font-size: 0.9rem;
}
</style>
