import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(): TrpcContext {
  return {
    user: undefined,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("BigMart dashboard procedures", () => {
  it("returns artifact metrics and exact data quality figures", async () => {
    const result = await appRouter.createCaller(context()).dashboard.overview();
    expect(result.metadata.model_version).toBe("bigmart_model_v001");
    expect(result.metadata.metrics.holdout_r2).toBeGreaterThan(0.5);
    expect(result.quality.zero_visibility).toBe(526);
    expect(result.baseline.rmse).toBe(1084.945507581264);
  });

  it("rejects batch files without the trained feature schema", async () => {
    await expect(appRouter.createCaller(context()).predictions.run({ filename: "bad.csv", csv: "foo,bar\n1,2" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("runs the Ridge artifact through the Python subprocess", async () => {
    const csv = [
      "Item_Identifier,Item_Weight,Item_Fat_Content,Item_Visibility,Item_Type,Item_MRP,Outlet_Identifier,Outlet_Establishment_Year,Outlet_Size,Outlet_Location_Type,Outlet_Type",
      "FDA15,9.3,Low Fat,0.016047301,Dairy,249.8092,OUT049,1999,Medium,Tier 1,Supermarket Type1",
    ].join("\n");
    const result = await appRouter.createCaller(context()).predictions.run({ filename: "valid.csv", csv });
    expect(result).toMatchObject({ rowCount: 1, modelVersion: "bigmart_model_v001" });
    expect((result as { predictionSummary: { mean: number } }).predictionSummary.mean).toBeGreaterThan(0);
  }, 15_000);
});
