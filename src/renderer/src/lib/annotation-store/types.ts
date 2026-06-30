import { Annotation } from '../../types';

export interface AnnotationFile {
  schemaVersion: string;
  musicXmlPath: string;
  updatedAt: string;
  annotations: Annotation[];
}
