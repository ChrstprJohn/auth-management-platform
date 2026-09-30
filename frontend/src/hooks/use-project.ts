import { useOutletContext } from 'react-router-dom'
import type { Project } from '@/types/project'
export function useProject() {
  return useOutletContext<{ project: Project; reload: () => void }>()
}
