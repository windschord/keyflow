export type Finger = 1 | 2 | 3 | 4 | 5;

export interface Annotation {
  noteId: string;
  fingerNumber?: Finger;
  comment?: string;
  isAISuggested: boolean;
  isApproved: boolean;
}

export interface FingerAssignment {
  noteId: string;
  finger: Finger;
  cost: number;
}
