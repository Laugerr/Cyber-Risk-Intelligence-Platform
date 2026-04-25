import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get("q") || "";
  const cveId = searchParams.get("cve") || "";

  const apiKey = process.env.NVD_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["apiKey"] = apiKey;

  try {
    let url: string;
    if (cveId) {
      url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId.toUpperCase())}`;
    } else {
      url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(keyword)}&resultsPerPage=20`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`NVD ${res.status}`);
    const data = await res.json();

    const items = (data.vulnerabilities || []).map((v: Record<string, unknown>) => {
      const cve = (v.cve || {}) as Record<string, unknown>;
      const descs = (cve.descriptions as { lang: string; value: string }[]) || [];
      const desc = descs.find((d) => d.lang === "en")?.value || "";
      const metrics = (cve.metrics || {}) as Record<string, unknown>;
      let cvss: number | null = null;
      for (const key of ["cvssMetricV31", "cvssMetricV30", "cvssMetricV40", "cvssMetricV2"]) {
        const arr = metrics[key] as { cvssData?: { baseScore?: number } }[];
        if (Array.isArray(arr) && arr[0]?.cvssData?.baseScore != null) {
          cvss = arr[0].cvssData.baseScore;
          break;
        }
      }
      return {
        cve_id: cve.id,
        description: desc,
        cvss,
        published: cve.published,
        url: `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      };
    });

    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
