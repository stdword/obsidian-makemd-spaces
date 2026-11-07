import { arrayMove } from "utils/array";

describe("arrayMove", () => {
    it("moves an item forward and backward without mutating the input", () => {
        const input = ["a", "b", "c", "d"];
        expect(arrayMove(input, 0, 2)).toEqual(["b", "c", "a", "d"]);
        expect(arrayMove(input, 3, 1)).toEqual(["a", "d", "b", "c"]);
        expect(input).toEqual(["a", "b", "c", "d"]);
    });

    it("clamps the target index and ignores an invalid source", () => {
        expect(arrayMove([1, 2, 3], 0, 10)).toEqual([2, 3, 1]);
        expect(arrayMove([1, 2, 3], 2, -5)).toEqual([3, 1, 2]);
        expect(arrayMove([1, 2, 3], 7, 0)).toEqual([1, 2, 3]);
    });
});
