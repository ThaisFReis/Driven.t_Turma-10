import { Address, Enrollment } from '@prisma/client';
import { request } from '@/utils/request';
import { invalidDataError, notFoundError } from '@/errors';
import addressRepository, { CreateAddressParams } from '@/repositories/address-repository';
import enrollmentRepository, { CreateEnrollmentParams } from '@/repositories/enrollment-repository';
import { exclude } from '@/utils/prisma-utils';
import { ViaCEPAddress, AddressEnrollment } from '@/protocols';
import { getAddress } from '@/utils/cep';

// Receber o CEP por parâmetro nesta função.
async function getAddressFromCEP(cep: string) {

  // Se eu usar o getAddress, ele não funciona no teste, pois ele não consegue fazer a requisição.
  const address = await request.get(`${process.env.VIA_CEP_API}/${cep}/json/`);

  // Verificar se o CEP é válido.
  if (!address.data || address.data.erro) throw notFoundError();

  const  {  logradouro, complemento, bairro, localidade, uf } = address.data;

  const addressEnrollment: AddressEnrollment = {
    logradouro,
    complemento,
    bairro,
    cidade: localidade,
    uf,
  };

  return addressEnrollment;
}

async function getOneWithAddressByUserId(userId: number): Promise<GetOneWithAddressByUserIdResult> {
  const enrollmentWithAddress = await enrollmentRepository.findWithAddressByUserId(userId);

  if (!enrollmentWithAddress) throw notFoundError();

  const [firstAddress] = enrollmentWithAddress.Address;
  const address = getFirstAddress(firstAddress);

  return {
    ...exclude(enrollmentWithAddress, 'userId', 'createdAt', 'updatedAt', 'Address'),
    ...(!!address && { address }),
  };
}

type GetOneWithAddressByUserIdResult = Omit<Enrollment, 'userId' | 'createdAt' | 'updatedAt'>;

function getFirstAddress(firstAddress: Address): GetAddressResult {
  if (!firstAddress) return null;

  return exclude(firstAddress, 'createdAt', 'updatedAt', 'enrollmentId');
}

type GetAddressResult = Omit<Address, 'createdAt' | 'updatedAt' | 'enrollmentId'>;

async function createOrUpdateEnrollmentWithAddress(params: CreateOrUpdateEnrollmentWithAddress) {
  const enrollment = exclude(params, 'address');
  const address = getAddressForUpsert(params.address);

  try{
    // Receber o CEP por parâmetro nesta função.
    await getAddressFromCEP(address.cep);
  }

  catch(error) {
    // Verificar se o erro é de CEP inválido.
    throw invalidDataError(['CEP inválido']); // Precisa ser um array pois a função espera um array de strings.
  }

  const enrollmentWithAddress = await enrollmentRepository.upsert(params.userId, enrollment, exclude(enrollment, 'userId'));

  await addressRepository.upsert(enrollmentWithAddress.id, address, address); // Precisa ser passado o endereço duas vezes pois o upsert espera três parâmetros. E precisa ser o adress por causa do CreateAddressParams.
}

function getAddressForUpsert(address: CreateAddressParams) {
  return {
    ...address,
    ...(address?.addressDetail && { addressDetail: address.addressDetail }),
  };
}

export type CreateOrUpdateEnrollmentWithAddress = CreateEnrollmentParams & {
  address: CreateAddressParams;
};

const enrollmentsService = {
  getAddressFromCEP,
  getOneWithAddressByUserId,
  createOrUpdateEnrollmentWithAddress,
};

export default enrollmentsService;
