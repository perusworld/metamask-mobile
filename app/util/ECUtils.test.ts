import elliptic from 'elliptic';

interface AndroidKeyData {
	privateKey: string;
	publicPointX: string;
	publicPointY: string;
}

describe('Encoded Public Key Test', () => {
	const ec = elliptic.curves.secp256k1;

	const androidGeneratedKeySet1: AndroidKeyData = {
		privateKey: 'c2ef448dd6bbb0eb81fb74ce89e218da4acb7f258c1899233c5b2962de0b09ed',
		publicPointX: '9ee354bf351314f4bf28d2ba5ad99c99f55c3da5d6e84f84cb9a76d2666d5f9b',
		publicPointY: '34b02f368de97272048ffb0dcb53067bdb77bd1cc46cd384dd430d856aaf59a3',
	};
	const androidGeneratedKeySet2: AndroidKeyData = {
		privateKey: 'bce8be7587c4773d4dc3e69416d2f065f2f929fe42acfb8d74c59cfbb1c7a165',
		publicPointX: '882f1fe35041fc769faeacb0731a309a8135c15eb5b37aa81489a467196d463b',
		publicPointY: '214578c4cbe09932a82c92e9e4fd51f84e3bdbb792dd051054b50e9d4cfb9925',
	};
	const androidGeneratedKeySet3: AndroidKeyData = {
		privateKey: 'ad95d9b9e22dc2fed21a921fb24bc3aea3fed718c24377994fe3d8c6ecff7aeb',
		publicPointX: '48ebe2e313de2b474ae549150f11fc8bed7d64ade4d9d97fe313fbf9be33733f',
		publicPointY: '533609c203d1d4939ce69564d1cba87126ac1fa777ac9ddebfdbfb16b6a75c0b',
	};

	it('- Successful Generation', () => {
		const result_point1 = ec.curve.point(
			androidGeneratedKeySet1.publicPointX,
			androidGeneratedKeySet1.publicPointY
		);
		const result_js1 = ec.g.mul(androidGeneratedKeySet1.privateKey);
		expect(result_point1.encode('true', null)).toStrictEqual(result_js1.encode('true', null));
		expect(result_point1.encode('false', null)).toStrictEqual(result_js1.encode('false', null));
		expect(result_point1.encode()).toStrictEqual(result_js1.encode());

		const result_point2 = ec.curve.point(
			androidGeneratedKeySet2.publicPointX,
			androidGeneratedKeySet2.publicPointY
		);
		const result_js2 = ec.g.mul(androidGeneratedKeySet2.privateKey);
		expect(result_point2.encode('true', null)).toStrictEqual(result_js2.encode('true', null));
		expect(result_point2.encode('false', null)).toStrictEqual(result_js2.encode('false', null));
		expect(result_point2.encode()).toStrictEqual(result_js2.encode());

		const result_point3 = ec.curve.point(
			androidGeneratedKeySet3.publicPointX,
			androidGeneratedKeySet3.publicPointY
		);
		const result_js3 = ec.g.mul(androidGeneratedKeySet3.privateKey);
		expect(result_point3.encode('true', null)).toStrictEqual(result_js3.encode('true', null));
		expect(result_point3.encode('false', null)).toStrictEqual(result_js3.encode('false', null));
		expect(result_point3.encode()).toStrictEqual(result_js3.encode());
	});

	it('- Failed Generation', () => {
		const result_point1 = ec.curve.point(
			androidGeneratedKeySet1.publicPointX,
			androidGeneratedKeySet1.publicPointY
		);
		const result_js1 = ec.g.mul(androidGeneratedKeySet2.privateKey);
		expect(result_point1.encode(true, 'hex') !== result_js1.encode(true, 'hex')).toBe(true);
	});
});
