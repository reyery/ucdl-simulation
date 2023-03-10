import {
	DataTextureLoader,
	LinearFilter,
	LinearMipmapLinearFilter
} from 'three';

import * as UTIF from 'utif';

class TIFFLoader extends DataTextureLoader {

	constructor( manager ) {

		super( manager );

	}

	parse( buffer ) {
		console.log(UTIF)
		const ifds = UTIF.decode( buffer );
		UTIF.decodeImage( buffer, ifds[ 0 ] );
		const rgba = UTIF.toRGBA8( ifds[ 0 ] );

		return {
			width: ifds[ 0 ].width,
			height: ifds[ 0 ].height,
			data: rgba,
			flipY: true,
			magFilter: LinearFilter,
			minFilter: LinearMipmapLinearFilter
		};

	}

}

export { TIFFLoader };
