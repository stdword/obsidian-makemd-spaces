import { Anchors, Rect, Size } from "shared/types/Pos";

export const calculateBoundsBasedOnPosition = (targetRect: Rect, rect: DOMRect, bounds: Size, anchor: Anchors) => {
    const viewportPadding = 12;
    const x = anchor === "bottom" ? targetRect.x : targetRect.x + targetRect.width;
    const y = anchor === "top" ? targetRect.y - rect.height - 10 : anchor == "right" ? targetRect.y : targetRect.y + targetRect.height + 10;
    const overflowX = x + rect.width - bounds.width;
    const overflowY = y + rect.height - bounds.height;
    let newY = y;
    let newX = x;
    if (overflowX > 0) {
        if (targetRect.x - rect.width < 0) newX = Math.max(viewportPadding, bounds.width - rect.width - viewportPadding);
        else {
            newX = targetRect.x - rect.width;
        }
    }
    let newHeight = rect.height;
    if (overflowY > 0 && anchor == "bottom") {
        newHeight = Math.max(0, bounds.height - newY);
    } else if (overflowY > 0) {
        if (targetRect.y - rect.height < 0) newY = targetRect.y - overflowY;
        else {
            newY = targetRect.y - rect.height - 10;
        }
    }
    return {
        x: newX,
        y: newY,
        width: rect.width,
        height: newHeight,
    };
};
