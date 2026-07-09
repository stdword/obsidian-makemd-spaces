import { parseSpaceMetadata } from "core/utils/superstate/spaces";

describe("parseSpaceMetadata", () => {
    it("does not preserve legacy presentation/template fields", () => {
        const metadata = parseSpaceMetadata(
            {
                _joins: [],
                _contexts: [],
                _links: [],
                _template: "",
                _templateName: "",
                readMode: true,
                fullWidth: true,
            },
            {} as any,
        );

        expect(metadata).not.toHaveProperty("_template");
        expect(metadata).not.toHaveProperty("_templateName");
        expect(metadata).not.toHaveProperty("joins");
        expect(metadata).not.toHaveProperty("contexts");
        expect(metadata).not.toHaveProperty("readMode");
        expect(metadata).not.toHaveProperty("fullWidth");
    });
});
