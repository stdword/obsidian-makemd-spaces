import { parseURI } from "shared/utils/uri";

describe("parseURI", () => {
  it("keeps question marks and percent signs in plain vault paths", () => {
    const path = "Efforts/How To Build A Better Personal Brand Than 99% Of People?.md";

    const uri = parseURI(path);

    expect(uri.fullPath).toBe(path);
    expect(uri.path).toBe(path);
    expect(uri.query).toBeNull();
  });

  it("does not throw on malformed percent escapes in explicit URI query strings", () => {
    const uri = parseURI("spaces://$tags/?q=99% Of People");

    expect(uri.query).toEqual({ q: "99% Of People" });
  });
});
