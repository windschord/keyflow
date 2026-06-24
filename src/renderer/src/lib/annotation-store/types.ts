import type { Annotation } from '../../types/annotation';

export interface AnnotationFile {
  version: string;
  annotations: Annotation[];
}
