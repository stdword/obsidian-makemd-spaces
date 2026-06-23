
export type SpaceFragmentType = "context" | 'action' | 'vis';

export type SpaceFragmentSchema = {
  id: string;
  name: string;
  sticker?: string;
  type: SpaceFragmentType;
  path: string;
};
