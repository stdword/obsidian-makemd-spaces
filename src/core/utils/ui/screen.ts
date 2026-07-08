import { InteractionType, ScreenType } from "shared/types/ui";
import { IUIManager } from "shared/types/uiManager";

export const isTouchScreen = (ui: IUIManager) => ui.primaryInteractionType() == InteractionType.Touch;
export const isPhone = (ui: IUIManager) => ui.getScreenType() == ScreenType.Phone;
