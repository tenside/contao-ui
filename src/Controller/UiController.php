<?php

/**
 * This file is part of tenside/contao-ui.
 *
 * (c) Christian Schiffler <c.schiffler@cyberspectrum.de>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 *
 * This project is provided in good faith and hope to be usable by anyone.
 *
 * @package    tenside/contao-ui
 * @author     Christian Schiffler <c.schiffler@cyberspectrum.de>
 * @copyright  2015 Christian Schiffler <c.schiffler@cyberspectrum.de>
 * @license    https://github.com/tenside/contao-ui/blob/master/LICENSE MIT
 * @link       https://github.com/tenside/contao-ui
 * @filesource
 */

namespace Tenside\ContaoUi\Controller;

use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Tenside\CoreBundle\Controller\AbstractController;

/**
 * Provide access to all embedded asset files.
 */
class UiController extends AbstractController
{
    /**
     * Redirect any request to the "/" path to the index.html file.
     *
     * @param Request $request The request to process.
     *
     * @return RedirectResponse
     */
    public function rootRedirectAction(Request $request)
    {
        $uri = $request->getUri();

        return new RedirectResponse(rtrim($uri, '/') . '/index.html');
    }

    /**
     * Provide the index.html file.
     *
     * @param Request $request The request to process.
     *
     * @return Response
     */
    public function indexAction(Request $request)
    {
        return new Response(
            $this->fixApiBaseUrl($request, file_get_contents($this->getAssetsDir() . '/index.html')),
            200,
            [
                'Content-Type' => 'text/html; charset=UTF-8'
            ]
        );
    }

    /**
     * Provide an asset.
     *
     * @param string  $path    The assets sub dir.
     *
     * @param string  $file    The file name within the sub dir..
     *
     * @param Request $request The request to process.
     *
     * @return Response
     */
    public function assetAction($path, $file, Request $request)
    {
        $filePath = $this->getAssetsDir() . '/' . $path . '/' . $file;

        if (!file_exists($filePath)) {
            return new Response($filePath . ' not found', 404);
        }

        $response = new Response();
        $response->setPublic();
        $response->headers->addCacheControlDirective('must-revalidate', true);

        $lastModified = filemtime($filePath);

        $response->setETag(md5($filePath . $lastModified));
        $response->setLastModified(new \DateTime('@' . $lastModified));

        if ($response->isNotModified($request)) {
            // return the 304 Response immediately
            return $response;
        }

        $mime = $this->getMime($filePath);
        if ($mime !== null) {
            $response->headers->set('Content-Type', $mime);
        }

        return $response->setContent(file_get_contents($filePath));
    }

    /**
     * Retrieve the mime type of a file.
     *
     * @param string $filePath The filename for which the mime shall be guessed.
     *
     * @return string|null
     */
    private function getMime($filePath)
    {
        $chunks = explode('.', $filePath);
        if (count($chunks) > 1) {
            $fileExtension = array_pop($chunks);
            foreach ([
                    'js'    => 'text/javascript; charset=UTF-8',
                    'map'   => 'application/json',
                    'css'   => 'text/css; charset=UTF-8',
                    'png'   => 'image/png',
                    'svg'   => 'image/svg+xml',
                    'woff'  => 'application/font-woff',
                    'woff2' => 'font/woff2',
                    'json'  => 'application/json',
                    'html'  => 'text/html; charset=UTF-8',
                ] as $extension => $mimeType) {
                if ($fileExtension === $extension) {
                    return $mimeType;
                }
            }
        }

        return null;
    }

    /**
     * Retrieve the assets dir.
     *
     * @return string
     *
     * @throws \RuntimeException When the assets dir can not be located.
     */
    private function getAssetsDir()
    {
        if ($phar = \Phar::running()) {
            return $phar . '/assets';
        }

        // FIXME: hardcoded assets path for non phar mode - change this!
        $dir = dirname(__DIR__);
        while (($dir = dirname($dir)) !== '.') {
            if (is_dir($dir . '/.build')) {
                return $dir . '/.build';
            }
        }

        throw new \RuntimeException('Could not find assets directory.');
    }

    /**
     * Replace the magic API base url determining code with the fixed url to the current installation in templates.
     *
     * @param Request $request The request to extract the base url from.
     *
     * @param string  $content The template code.
     *
     * @return string
     */
    private function fixApiBaseUrl(Request $request, $content)
    {
        return str_replace(
            'window.location.href.substring(0, window.location.href.split(\'#\')[0].lastIndexOf(\'/\'));',
            '\'' . dirname($request->getUri()) . '\';',
            $content
        );
    }
}
