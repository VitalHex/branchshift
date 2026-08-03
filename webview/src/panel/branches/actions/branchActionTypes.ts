import type {
  BranchInfo,
  GitRefIdentity,
  TagInfo,
} from "../../../shared/types/git";

export interface BranchActionContext {
  repoId: string;
  ref: GitRefIdentity;
  branch?: BranchInfo;
  tag?: TagInfo;
  currentBranch: string;
}
