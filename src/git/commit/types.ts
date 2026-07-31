export interface CommitPathSelection {
  path: string;
  oldPath?: string;
  includeIndex: boolean;
  includeWorkingTree: boolean;
}

export interface IndexEntry {
  mode: string;
  objectId: string;
  stage: 0;
  path: string;
}
