import { ViaCEPAddress } from "@/protocols";
import { request } from "@/utils/request";

async function getAddress(cep: string): Promise<ViaCEPAddress> {
    const result = await request.get(`${process.env.VIA_CEP_URL}/${cep}/json/`);

    return result.data;
}

export { getAddress };