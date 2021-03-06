import { pipe, pipeWith } from 'pipe-ts';
import { ParsedUrlQueryInput } from 'querystring';
import * as urlHelpers from 'url';
import { getOrElseMaybe, mapMaybe } from './helpers/maybe';
import { flipCurried, isNonEmptyString } from './helpers/other';

interface NodeUrlObjectWithParsedQuery extends urlHelpers.UrlObject {
    query: ParsedUrlQueryInput;
}

type Update<T> = T | ((prev: T) => T);

const getPathnameFromParts = (parts: string[]) => `/${parts.join('/')}`;

const getPartsFromPathname = (pathname: string) => pathname.split('/').filter(isNonEmptyString);

const parseUrlWithQueryString = (url: string) =>
    urlHelpers.parse(
        url,
        // Parse the query string
        true,
    );

// We omit some properties since they're just serialized versions of other properties.
type ParsedUrl = Required<
    Pick<
        NodeUrlObjectWithParsedQuery,
        'auth' | 'hash' | 'hostname' | 'pathname' | 'port' | 'protocol' | 'query' | 'slashes'
    >
>;

const convertNodeUrl = ({
    auth,
    hash,
    hostname,
    pathname,
    port,
    protocol,
    query,
    slashes,
}: urlHelpers.UrlWithParsedQuery): ParsedUrl => ({
    auth,
    hash,
    hostname,
    pathname,
    port,
    protocol,
    query,
    slashes,
});

type MapParsedUrlFn = ({ parsedUrl }: { parsedUrl: ParsedUrl }) => ParsedUrl;
export const mapParsedUrl = (fn: MapParsedUrlFn): MapParsedUrlFn => ({ parsedUrl }) =>
    fn({ parsedUrl });

type MapUrlFn = ({ url }: { url: string }) => string;
export const mapUrl = (fn: MapParsedUrlFn): MapUrlFn =>
    pipe(
        ({ url }) => parseUrlWithQueryString(url),
        convertNodeUrl,
        parsedUrl => fn({ parsedUrl }),
        urlHelpers.format,
    );

export const replaceQueryInParsedUrl = ({
    newQuery,
}: {
    newQuery: Update<ParsedUrl['query']>;
}): MapParsedUrlFn => ({ parsedUrl }) => ({
    ...parsedUrl,
    query: newQuery instanceof Function ? newQuery(parsedUrl.query) : newQuery,
});

export const replaceQueryInUrl = flipCurried(
    pipe(
        replaceQueryInParsedUrl,
        mapUrl,
    ),
);

export const addQueryToParsedUrl = ({
    queryToAppend,
}: {
    queryToAppend: ParsedUrl['query'];
}): MapParsedUrlFn =>
    replaceQueryInParsedUrl({
        newQuery: existingQuery => ({ ...existingQuery, ...queryToAppend }),
    });

export const addQueryToUrl = flipCurried(
    pipe(
        addQueryToParsedUrl,
        mapUrl,
    ),
);

type ParsedPath = Pick<ParsedUrl, 'query' | 'pathname'>;

const parsePath = pipe(
    (path: string) => urlHelpers.parse(path, true),
    ({ query, pathname }): ParsedPath => ({ query, pathname }),
);

const getParsedPathFromString = (maybePath: NodeUrlObjectWithParsedQuery['path']): ParsedPath =>
    pipeWith(
        maybePath,
        maybe => mapMaybe(maybe, parsePath),
        maybe => getOrElseMaybe(maybe, () => ({ query: {}, pathname: null })),
    );

export const replacePathInParsedUrl = ({
    newPath,
}: {
    newPath: Update<NodeUrlObjectWithParsedQuery['path']>;
}): MapParsedUrlFn => ({ parsedUrl }) =>
    pipeWith(
        newPath instanceof Function ? newPath(parsedUrl.pathname) : newPath,
        getParsedPathFromString,
        newPathParsed => ({ ...parsedUrl, ...newPathParsed }),
    );

export const replacePathInUrl = flipCurried(
    pipe(
        replacePathInParsedUrl,
        mapUrl,
    ),
);

export const replacePathnameInParsedUrl = ({
    newPathname,
}: {
    newPathname: Update<ParsedUrl['pathname']>;
}): MapParsedUrlFn => ({ parsedUrl }) => ({
    ...parsedUrl,
    pathname: newPathname instanceof Function ? newPathname(parsedUrl.pathname) : newPathname,
});

export const replacePathnameInUrl = flipCurried(
    pipe(
        replacePathnameInParsedUrl,
        mapUrl,
    ),
);

export const appendPathnameToParsedUrl = ({
    pathnameToAppend,
}: {
    pathnameToAppend: string;
}): MapParsedUrlFn =>
    replacePathnameInParsedUrl({
        newPathname: prevPathname => {
            const pathnameParts = pipeWith(mapMaybe(prevPathname, getPartsFromPathname), maybe =>
                getOrElseMaybe(maybe, () => []),
            );
            const pathnamePartsToAppend = getPartsFromPathname(pathnameToAppend);
            const newPathnameParts = [...pathnameParts, ...pathnamePartsToAppend];
            const newPathname = getPathnameFromParts(newPathnameParts);
            return newPathname;
        },
    });

export const appendPathnameToUrl = flipCurried(
    pipe(
        appendPathnameToParsedUrl,
        mapUrl,
    ),
);

export const replaceHashInParsedUrl = ({
    newHash,
}: {
    newHash: Update<ParsedUrl['hash']>;
}): MapParsedUrlFn => ({ parsedUrl }) => ({
    ...parsedUrl,
    hash: newHash instanceof Function ? newHash(parsedUrl.hash) : newHash,
});

export const replaceHashInUrl = flipCurried(
    pipe(
        replaceHashInParsedUrl,
        mapUrl,
    ),
);
