import { DEFAULT_FILTERS, PROJECT_FORMAT_VERSION, type Project } from '../src/types/models'

export function emptyProjectForTests(): Project {
  return {
    id: 'p_test',
    name: 'Test',
    formatVersion: PROJECT_FORMAT_VERSION,
    createdAt: 0,
    updatedAt: 0,
    image: { name: 't.png', type: 'image/png', width: 1000, height: 1000 },
    perspective: null,
    filters: { ...DEFAULT_FILTERS },
    lines: [],
    groups: [],
    notes: '',
  }
}
