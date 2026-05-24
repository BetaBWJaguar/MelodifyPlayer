const CATEGORIES = {
    pop: {
        name: 'pop',
        tags: ['pop', 'synthpop', 'electropop', 'indie pop', 'chamber pop', 'art pop', 'dance pop', 'teen pop', 'k-pop', 'kpop', 'j-pop', 'jpop', 'c-pop', 'mandopop', 'cantopop', 'power pop', 'bubblegum', 'bubblegum pop', 'europop', 'latin pop', 'pop rock', 'pop punk', 'pop soul', 'pop rap', 'hyperpop']
    },
    rock: {
        name: 'rock',
        tags: ['rock', 'classic rock', 'hard rock', 'progressive rock', 'psychedelic rock', 'garage rock', 'southern rock', 'blues rock', 'stoner rock', 'space rock', 'surf rock', 'glam rock', 'art rock', 'krautrock', 'post-rock', 'post rock', 'math rock', 'noise rock', 'j-rock']
    },
    hiphop: {
        name: 'hiphop',
        tags: ['hip-hop', 'hip hop', 'hiphop', 'rap', 'gangsta rap', 'trap', 'conscious hip hop', 'underground hip hop', 'west coast rap', 'east coast rap', 'dirty south', 'southern hip hop', 'mumble rap', 'drill', 'boom bap', 'lo-fi hip hop', 'lo-fi', 'lofi', 'chillhop']
    },
    electronic: {
        name: 'electronic',
        tags: ['electronic', 'edm', 'house', 'techno', 'trance', 'dubstep', 'drum and bass', 'dnb', 'd&b', 'ambient', 'downtempo', 'chillout', 'chill out', 'idm', 'electro', 'deep house', 'progressive house', 'tech house', 'minimal', 'minimal techno', 'hardstyle', 'dnb', 'jungle', 'garage', 'uk garage', 'future bass', 'future garage', 'synthwave', 'retrowave', 'vaporwave', 'dub', 'trip hop', 'trip-hop', 'dub techno', 'glitch', 'chiptune', 'happy hardcore', 'hardcore techno', 'psytrance', 'minimalism']
    },
    rnb: {
        name: 'rnb',
        tags: ['rnb', 'r&b', 'r and b', 'soul', 'neo soul', 'neo-soul', 'alternative r&b', 'contemporary r&b', 'funk', 'motown', 'northern soul', 'blue-eyed soul']
    },
    jazz: {
        name: 'jazz',
        tags: ['jazz', 'smooth jazz', 'bebop', 'cool jazz', 'free jazz', 'fusion', 'jazz fusion', 'big band', 'swing', 'latin jazz', 'acid jazz', 'nu jazz', 'vocal jazz', 'contemporary jazz', 'jazz rap']
    },
    classical: {
        name: 'classical',
        tags: ['classical', 'orchestral', 'symphony', 'chamber music', 'opera', 'baroque', 'romantic', 'contemporary classical', 'neo-classical', 'neoclassical', 'classical piano', 'choral', 'early music']
    },
    metal: {
        name: 'metal',
        tags: ['metal', 'heavy metal', 'death metal', 'black metal', 'thrash metal', 'power metal', 'doom metal', 'progressive metal', 'nu metal', 'metalcore', 'deathcore', 'symphonic metal', 'gothic metal', 'folk metal', 'industrial metal', 'alternative metal', 'speed metal', 'groove metal', 'sludge metal', 'djent']
    },
    country: {
        name: 'country',
        tags: ['country', 'country rock', 'alt-country', 'alternative country', 'country pop', 'outlaw country', 'bluegrass', 'new country', 'country blues', 'americana', 'honky tonk', 'western swing']
    },
    latin: {
        name: 'latin',
        tags: ['latin', 'reggaeton', 'reggaetón', 'salsa', 'bachata', 'cumbia', 'bossa nova', 'latin jazz', 'latin rock', 'latin trap', 'merengue', 'regional mexicano', 'norteño', 'banda', 'corrido', 'ranchera', 'tango', 'samba', 'forró', 'mpb', 'sertanejo', 'funk carioca', 'dembow']
    },
    indie: {
        name: 'indie',
        tags: ['indie', 'indie rock', 'indie folk', 'indie electronic', 'indie pop', 'indie alternative', 'lo-fi indie', 'indie singer-songwriter', 'bedroom pop', 'shoegaze', 'dream pop', 'slowcore', 'emo', 'midwest emo', 'post-punk', 'new wave', 'darkwave', 'coldwave']
    },
    folk: {
        name: 'folk',
        tags: ['folk', 'acoustic', 'singer-songwriter', 'folk rock', 'folk pop', 'neo-folk', 'neofolk', 'world music', 'celtic', 'irish folk', 'traditional', 'americana', 'roots', 'bluegrass']
    },
    reggae: {
        name: 'reggae',
        tags: ['reggae', 'dub', 'ska', 'dancehall', 'roots reggae', 'ragga', 'lovers rock', 'reggaeton']
    },
    blues: {
        name: 'blues',
        tags: ['blues', 'delta blues', 'chicago blues', 'electric blues', 'blues rock', 'country blues', 'acoustic blues', 'blues soul', 'texas blues', 'piedmont blues', 'rhythm and blues']
    },
    punk: {
        name: 'punk',
        tags: ['punk', 'punk rock', 'hardcore punk', 'post-punk', 'pop punk', 'skate punk', 'street punk', 'anarcho-punk', 'crust punk', 'ska punk', 'emo', 'grunge', 'no wave']
    },
    soundtrack: {
        name: 'soundtrack',
        tags: ['soundtrack', 'score', 'film score', 'movie', 'musical', 'video game music', 'game soundtrack', 'anime', 'anime OST', 'OST', 'background music']
    },
    alternative: {
        name: 'alternative',
        tags: ['alternative', 'alternative rock', 'alt-rock', 'alt rock', 'grunge', 'britpop', 'madchester', 'noise pop', 'riot grrrl', 'screamo']
    }
};

const tagToCategoryMap = {};
for (const [categoryKey, category] of Object.entries(CATEGORIES)) {
    for (const tag of category.tags) {
        tagToCategoryMap[tag.toLowerCase()] = categoryKey;
    }
}


function mapTagToCategory(tag) {
    if (!tag) return 'other';
    
    const normalizedTag = tag.toLowerCase().trim();
    
    if (tagToCategoryMap[normalizedTag]) {
        return tagToCategoryMap[normalizedTag];
    }
    
    for (const [mapTag, category] of Object.entries(tagToCategoryMap)) {
        if (normalizedTag.includes(mapTag) || mapTag.includes(normalizedTag)) {
            return category;
        }
    }
    
    return 'other';
}


function mapTagsToCategory(tags) {
    if (!tags || !Array.isArray(tags) || tags.length === 0) return 'other';
    
    const ignoreTags = ['seen live', 'favorites', 'favourite', 'favorite', 'awesome', 'amazing',
        'good', 'great', 'love', 'liked', 'like', 'best', 'cool', 'nice', 'beautiful', 'perfect',
        'under 2000 listeners', '2000s', '1990s', '1980s', '1970s', '1960s', '2010s', '2020s',
        'oldies', 'new', 'classic', 'legend', 'legendary', 'guilty pleasure', 'chill', 'party',
        'workout', 'study', 'focus', 'sleep', 'relax', 'road trip', 'summer'];
    
    for (const tag of tags) {
        const name = tag.toLowerCase().trim();
        if (ignoreTags.some(ignore => name.includes(ignore))) continue;
        if (name.length < 2 || name.length > 30) continue;
        
        const category = mapTagToCategory(name);
        if (category !== 'other') {
            return category;
        }
    }
    
    return 'other';
}


function getAllCategories() {
    return Object.keys(CATEGORIES).concat('other');
}


function getCategoryDisplayName(categoryKey) {
    const category = CATEGORIES[categoryKey];
    if (category) {
        return category.name.charAt(0).toUpperCase() + category.name.slice(1);
    }
    if (categoryKey === 'other') return 'Other';
    return categoryKey;
}

module.exports = {
    CATEGORIES,
    mapTagToCategory,
    mapTagsToCategory,
    getAllCategories,
    getCategoryDisplayName
};
